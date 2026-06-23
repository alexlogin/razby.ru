import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { publicApproval } from "@/lib/approvals";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED", "NEEDS_REVISION"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = decisionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const { id } = await params;
  const current = await prisma.approvalItem.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  const decision = {
    action: parsed.data.action,
    note: parsed.data.note,
    actorId: user.id,
    actorEmail: user.email,
    decidedAt: new Date().toISOString(),
  };

  const [approval] = await Promise.all([
    prisma.approvalItem.update({
      where: { id: current.id },
      data: {
        status: parsed.data.action,
        decisionJson: JSON.stringify(decision),
        decidedAt: new Date(),
      },
      include: {
        moduleRun: {
          select: {
            id: true,
            moduleSlug: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
      },
    }),
    current.moduleRunId
      ? prisma.moduleRun.update({
          where: { id: current.moduleRunId },
          data: {
            status:
              parsed.data.action === "APPROVED"
                ? "APPROVED_FOR_WORKER"
                : parsed.data.action === "REJECTED"
                  ? "REJECTED"
                  : "NEEDS_REVISION",
          },
        })
      : Promise.resolve(null),
  ]);

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: `approval.${parsed.data.action.toLowerCase()}`,
    entity: "ApprovalItem",
    entityId: approval.id,
    metadata: {
      moduleRunId: current.moduleRunId,
      note: parsed.data.note,
    },
  });

  return NextResponse.json({ approval: publicApproval(approval) });
}
