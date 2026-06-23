import { NextResponse } from "next/server";
import { canAccessAdminRequest } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { testOpenRouter } from "@/lib/openrouter";
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

  if (service !== "openrouter") {
    return NextResponse.json({ error: "Only OpenRouter test is supported now" }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);

  try {
    const result = await testOpenRouter(workspace.id);

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "integration.tested",
      entity: "IntegrationCredential",
      metadata: {
        service,
        ok: true,
        model: result.model,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "integration.tested",
      entity: "IntegrationCredential",
      metadata: {
        service,
        ok: false,
        message: error instanceof Error ? error.message : "Unknown OpenRouter error",
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown OpenRouter error",
      },
      { status: 400 },
    );
  }
}
