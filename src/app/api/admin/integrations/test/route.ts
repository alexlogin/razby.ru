import { NextResponse } from "next/server";
import { canAccessAdminRequest } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { testOpenRouter } from "@/lib/openrouter";
import { publicTelegramError, testTelegramSession } from "@/lib/telegram-runner";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdminRequest(request, user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const service = String(body.service ?? "");

  if (!["openrouter", "telegram-api", "telegram-session"].includes(service)) {
    return NextResponse.json({ error: "Only OpenRouter and Telegram session tests are supported now" }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);

  try {
    const result = service === "openrouter" ? await testOpenRouter(workspace.id) : await testTelegramSession(workspace.id);

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "integration.tested",
      entity: "IntegrationCredential",
      metadata: {
        service,
        ok: true,
        result:
          service === "openrouter"
            ? { model: "model" in result ? result.model : null }
            : { account: "account" in result ? result.account.username : null, sessionLabel: "sessionLabel" in result ? result.sessionLabel : null },
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = service === "openrouter" ? (error instanceof Error ? error.message : "Unknown OpenRouter error") : publicTelegramError(error);

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "integration.tested",
      entity: "IntegrationCredential",
      metadata: {
        service,
        ok: false,
        message,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
