import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { completeRunWithResult, queueModuleRun } from "@/lib/module-engine";
import { checkProxies } from "@/lib/proxy-checker";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

const proxySchema = z.object({
  proxies: z.string().min(3),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = proxySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const queued = await queueModuleRun(workspace.id, "proxy-checker", {
    targets: parsed.data.proxies,
  }, user.id);
  const result = await checkProxies(parsed.data.proxies);
  const run = await completeRunWithResult({
    runId: queued.id,
    workspaceId: workspace.id,
    slug: "proxy-checker",
    result,
    actorId: user.id,
  });

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "proxy_check.completed",
    entity: "ModuleRun",
    entityId: run.id,
    metadata: result.stats,
  });

  return NextResponse.json({
    run: {
      ...run,
      input: JSON.parse(run.inputJson),
      result: run.resultJson ? JSON.parse(run.resultJson) : null,
      logs: run.logsJson ? JSON.parse(run.logsJson) : [],
    },
  });
}
