import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdminRequest } from "@/lib/admin-auth";
import { defaultRuntimeSettings, getRuntimeAdminSettings, saveRuntimeAdminSettings } from "@/lib/admin-settings";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceReadiness } from "@/lib/readiness";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  executionMode: z.enum(["simulate", "live"]),
  liveSafetyAcknowledged: z.boolean(),
  defaultApproval: z.enum(["manual", "auto"]),
  operatorEmail: z.union([z.string().email(), z.literal("")]),
  telegramAlertChat: z.string().trim().max(128),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdminRequest(request, user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspace = await ensureWorkspace(user.id);
  const [settings, readiness] = await Promise.all([
    getRuntimeAdminSettings(workspace.id),
    getWorkspaceReadiness(workspace.id),
  ]);

  return NextResponse.json({ settings, readiness });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdminRequest(request, user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = settingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.executionMode === "live" && !parsed.data.liveSafetyAcknowledged) {
    return NextResponse.json({ error: "Live mode requires explicit safety acknowledgement" }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const settings = {
    ...defaultRuntimeSettings(),
    ...parsed.data,
  };

  await saveRuntimeAdminSettings(workspace.id, settings);
  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "admin.runtime_settings.saved",
    entity: "Workspace",
    entityId: workspace.id,
    metadata: {
      executionMode: settings.executionMode,
      defaultApproval: settings.defaultApproval,
      hasOperatorEmail: Boolean(settings.operatorEmail),
      hasTelegramAlertChat: Boolean(settings.telegramAlertChat),
    },
  });

  const readiness = await getWorkspaceReadiness(workspace.id);

  return NextResponse.json({ settings, readiness });
}
