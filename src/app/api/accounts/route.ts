import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

const accountSchema = z.object({
  label: z.string().min(2),
  username: z.string().min(2),
  phone: z.string().optional(),
  proxy: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  return NextResponse.json({ accounts: workspace.telegramAccounts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = accountSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const account = await prisma.telegramAccount.create({
    data: {
      workspaceId: workspace.id,
      label: parsed.data.label,
      username: parsed.data.username,
      phone: parsed.data.phone,
      proxy: parsed.data.proxy,
      notes: parsed.data.notes,
      status: "WARMING",
      healthScore: 72,
      ggrScore: 6.8,
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "telegram_account.created",
    entity: "TelegramAccount",
    entityId: account.id,
    metadata: { username: account.username, status: account.status },
  });

  return NextResponse.json({ account }, { status: 201 });
}
