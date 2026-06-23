import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { publicApproval } from "@/lib/approvals";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const approvals = await prisma.approvalItem.findMany({
    where: {
      workspaceId: workspace.id,
      ...(status && status !== "ALL" ? { status } : {}),
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
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ approvals: approvals.map(publicApproval) });
}
