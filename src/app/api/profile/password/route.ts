import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { hashUserPassword, validateNewPassword, verifyUserPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const passwordSchema = z.object({
  currentPassword: z.string().optional().default(""),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = passwordSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Заполните пароль." }, { status: 400 });
  }

  const passwordError = validateNewPassword(parsed.data.password);

  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (user.passwordHash) {
    const currentPasswordOk = await verifyUserPassword(parsed.data.currentPassword, user.passwordHash);

    if (!currentPasswordOk) {
      return NextResponse.json({ error: "Текущий пароль не подошёл." }, { status: 403 });
    }
  }

  const passwordHash = await hashUserPassword(parsed.data.password);
  const [workspace] = await Promise.all([
    ensureWorkspace(user.id),
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    }),
  ]);

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: user.passwordHash ? "profile.password.changed" : "profile.password.created",
    entity: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
    },
  });

  return NextResponse.json({ ok: true, hasPassword: true });
}
