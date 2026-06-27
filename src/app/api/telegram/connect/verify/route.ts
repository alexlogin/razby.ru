import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { verifyTelegramAccountConnect } from "@/lib/telegram-connect";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifySchema = z.object({
  authSessionId: z.string().trim().min(8),
  code: z.string().trim().max(32).optional(),
  password: z.string().trim().max(256).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = verifySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);

  try {
    const result = await verifyTelegramAccountConnect({
      workspaceId: workspace.id,
      actorId: user.id,
      authSessionId: parsed.data.authSessionId,
      code: parsed.data.code,
      password: parsed.data.password,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Telegram verification failed" }, { status: 400 });
  }
}
