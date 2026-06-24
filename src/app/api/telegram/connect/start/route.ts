import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { startTelegramAccountConnect } from "@/lib/telegram-connect";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startSchema = z.object({
  label: z.string().trim().min(2).max(64),
  phone: z.string().trim().min(8).max(32),
  forceSms: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = startSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);

  try {
    const auth = await startTelegramAccountConnect({
      workspaceId: workspace.id,
      actorId: user.id,
      label: parsed.data.label,
      phone: parsed.data.phone,
      forceSms: parsed.data.forceSms,
    });

    return NextResponse.json({ auth }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Telegram connect failed" }, { status: 400 });
  }
}
