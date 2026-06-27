import { prisma } from "@/lib/prisma";
import { getModule } from "@/lib/modules";
import { logAudit } from "@/lib/audit";
import { createRunApproval, needsHumanApproval } from "@/lib/approvals";
import { getModuleAdapter, type ModuleInput } from "@/lib/module-adapters";
import { enrichAiModuleResultWithOpenRouter } from "@/lib/openrouter";
import { getModuleReadiness } from "@/lib/readiness";
import { buildApprovedRunTelegramExecution, publicTelegramError } from "@/lib/telegram-runner";

type GeneratedLead = {
  username: string;
  displayName: string;
  bio: string;
  score: number;
  tags: string[] | string;
};

type RunLog = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
};

function readLogs(value: string | null | undefined): RunLog[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendRunLog(value: string | null | undefined, level: RunLog["level"], message: string) {
  return JSON.stringify([
    ...readLogs(value),
    {
      at: new Date().toISOString(),
      level,
      message,
    },
  ]);
}

function resultObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function parseRunResult(value: string | null | undefined) {
  if (!value) {
    return {};
  }

  try {
    return resultObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function buildWorkerExecution(input: {
  slug: string;
  result: Record<string, unknown>;
  workerId: string;
}) {
  const rows = Array.isArray(input.result.rows) ? input.result.rows : [];
  const policy = resultObject(input.result.policy);

  return {
    workerId: input.workerId,
    state: "DISPATCHED",
    dispatchedAt: new Date().toISOString(),
    actionCount: rows.length,
    risk: policy.risk ?? "unknown",
    approval: policy.approval ?? "unknown",
    rows: rows.slice(0, 50).map((row, index) => ({
      index: index + 1,
      status: "worker_dispatched",
      action: resultObject(row).action ?? resultObject(row).status ?? input.slug,
    })),
  };
}

export function buildModuleResult(slug: string, input: ModuleInput) {
  const adapter = getModuleAdapter(slug);

  if (!adapter) {
    throw new Error("Unknown module adapter");
  }

  return adapter.execute(input);
}

export async function queueModuleRun(workspaceId: string, slug: string, input: ModuleInput, actorId?: string | null) {
  const module = getModule(slug);

  if (!module && slug !== "proxy-checker") {
    throw new Error("Unknown module");
  }

  const run = await prisma.moduleRun.create({
    data: {
      workspaceId,
      moduleSlug: slug,
      title: module?.title ?? "Чекер прокси",
      status: "QUEUED",
      inputJson: JSON.stringify(input),
      logsJson: JSON.stringify([{ at: new Date().toISOString(), level: "info", message: "Run queued" }]),
    },
  });

  await logAudit({
    workspaceId,
    actorId,
    action: "module_run.queued",
    entity: "ModuleRun",
    entityId: run.id,
    metadata: { slug },
  });

  return run;
}

export async function completeRunWithResult(input: {
  runId: string;
  workspaceId: string;
  slug: string;
  result: unknown;
  actorId?: string | null;
}) {
  const finalStatus = needsHumanApproval(input.result) ? "PENDING_APPROVAL" : "COMPLETED";
  const logs = [
    { at: new Date().toISOString(), level: "info", message: "Run queued" },
    { at: new Date().toISOString(), level: "info", message: "Worker claimed task" },
    { at: new Date().toISOString(), level: "info", message: "Workspace limits checked" },
    {
      at: new Date().toISOString(),
      level: finalStatus === "PENDING_APPROVAL" ? "warn" : "info",
      message: finalStatus === "PENDING_APPROVAL" ? "Execution prepared and waiting for approval" : "Execution completed",
    },
  ];

  const run = await prisma.moduleRun.update({
    where: { id: input.runId },
    data: {
      status: finalStatus,
      resultJson: JSON.stringify(input.result),
      logsJson: JSON.stringify(logs),
      completedAt: new Date(),
    },
  });

  const resultRows =
    input.result && typeof input.result === "object" && "rows" in input.result
      ? (input.result as { rows?: unknown }).rows
      : undefined;

  if (input.slug.includes("parsing") || input.slug === "channel-parser" || input.slug === "neurochatting") {
    const rows = Array.isArray(resultRows) ? resultRows : [];
    const leads = rows
      .filter((row): row is GeneratedLead => Boolean((row as GeneratedLead).username))
      .slice(0, 8);

    if (leads.length > 0) {
      await prisma.lead.createMany({
        data: leads.map((lead) => ({
          workspaceId: input.workspaceId,
          source: input.slug,
          username: lead.username,
          displayName: lead.displayName,
          bio: lead.bio,
          score: lead.score,
          tags: JSON.stringify(Array.isArray(lead.tags) ? lead.tags : String(lead.tags).split("|")),
        })),
      });
    }
  }

  await logAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: finalStatus === "PENDING_APPROVAL" ? "module_run.pending_approval" : "module_run.completed",
    entity: "ModuleRun",
    entityId: run.id,
    metadata: { slug: input.slug },
  });

  const approval = await createRunApproval({
    workspaceId: input.workspaceId,
    moduleRunId: run.id,
    moduleSlug: input.slug,
    moduleTitle: run.title,
    result: input.result,
  });

  if (approval) {
    await logAudit({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: "approval.created",
      entity: "ApprovalItem",
      entityId: approval.id,
      metadata: { slug: input.slug, risk: approval.risk },
    });
  }

  return run;
}

export async function processQueuedRun(runId: string, actorId?: string | null) {
  const run = await prisma.moduleRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error("Run not found");
  }

  if (run.status === "COMPLETED") {
    return run;
  }

  await prisma.moduleRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      logsJson: JSON.stringify([
        { at: new Date().toISOString(), level: "info", message: "Run queued" },
        { at: new Date().toISOString(), level: "info", message: "Worker claimed task" },
      ]),
    },
  });

  const input = JSON.parse(run.inputJson) as ModuleInput;
  const readiness = await getModuleReadiness(run.workspaceId, run.moduleSlug);

  if (readiness.executionMode === "live" && !readiness.readyForLive) {
    const blockedResult = {
      summary: "Live-запуск остановлен: не хватает обязательных доступов или worker-сигнала.",
      stats: {
        missing: readiness.missingRequirements.length,
        risk: readiness.policy.risk,
        approval: readiness.policy.approval,
      },
      rows: readiness.missingRequirements.map((item) => ({
        requirement: item.label,
        state: item.state,
        action: item.help,
      })),
      policy: readiness.policy,
      readiness,
      nextActions: readiness.missingRequirements.map((item) => item.help),
    };

    const blockedRun = await prisma.moduleRun.update({
      where: { id: run.id },
      data: {
        status: "BLOCKED_SETUP",
        resultJson: JSON.stringify(blockedResult),
        logsJson: JSON.stringify([
          { at: new Date().toISOString(), level: "info", message: "Run queued" },
          { at: new Date().toISOString(), level: "info", message: "Worker claimed task" },
          { at: new Date().toISOString(), level: "warn", message: "Live readiness failed" },
        ]),
        completedAt: new Date(),
      },
    });

    await logAudit({
      workspaceId: run.workspaceId,
      actorId,
      action: "module_run.blocked_setup",
      entity: "ModuleRun",
      entityId: run.id,
      metadata: { slug: run.moduleSlug, missing: readiness.missingRequirements.map((item) => item.key) },
    });

    return blockedRun;
  }

  const baseResult = buildModuleResult(run.moduleSlug, input);
  const executionResult =
    readiness.executionMode === "live"
      ? await enrichAiModuleResultWithOpenRouter({
          workspaceId: run.workspaceId,
          slug: run.moduleSlug,
          moduleInput: input,
          result: baseResult,
        })
      : baseResult;

  const result = {
    ...executionResult,
    readiness: {
      executionMode: readiness.executionMode,
      readyForLive: readiness.readyForLive,
      missingRequirements: readiness.missingRequirements,
    },
  };

  return completeRunWithResult({
    runId: run.id,
    workspaceId: run.workspaceId,
    slug: run.moduleSlug,
    result,
    actorId,
  });
}

export async function processApprovedRun(runId: string, actorId?: string | null) {
  const run = await prisma.moduleRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error("Run not found");
  }

  if (run.status !== "APPROVED_FOR_WORKER") {
    return run;
  }

  const claimedRun = await prisma.moduleRun.update({
    where: { id: run.id },
    data: {
      status: "WORKER_RUNNING",
      logsJson: appendRunLog(run.logsJson, "info", "Approval accepted by worker"),
    },
  });

  const readiness = await getModuleReadiness(run.workspaceId, run.moduleSlug);

  if (readiness.executionMode === "live" && !readiness.readyForLive) {
    const blockedResult = {
      ...parseRunResult(run.resultJson),
      workerExecution: {
        state: "BLOCKED_SETUP",
        blockedAt: new Date().toISOString(),
        workerId: actorId ?? "worker",
        missingRequirements: readiness.missingRequirements.map((item) => ({
          key: item.key,
          label: item.label,
          help: item.help,
        })),
      },
    };

    const blockedRun = await prisma.moduleRun.update({
      where: { id: run.id },
      data: {
        status: "BLOCKED_SETUP",
        resultJson: JSON.stringify(blockedResult),
        logsJson: appendRunLog(claimedRun.logsJson, "warn", "Approved run blocked by live readiness"),
        completedAt: new Date(),
      },
    });

    await logAudit({
      workspaceId: run.workspaceId,
      actorId,
      action: "module_run.approved_blocked_setup",
      entity: "ModuleRun",
      entityId: run.id,
      metadata: { slug: run.moduleSlug, missing: readiness.missingRequirements.map((item) => item.key) },
    });

    return blockedRun;
  }

  const existingResult = parseRunResult(run.resultJson);
  let workerExecution: Record<string, unknown>;

  try {
    workerExecution =
      readiness.executionMode === "live"
        ? await buildApprovedRunTelegramExecution({
            workspaceId: run.workspaceId,
            moduleSlug: run.moduleSlug,
            result: existingResult,
            workerId: actorId ?? "worker",
          })
        : buildWorkerExecution({
            slug: run.moduleSlug,
            result: existingResult,
            workerId: actorId ?? "worker",
          });
  } catch (error) {
    const blockedResult = {
      ...existingResult,
      workerExecution: {
        state: "TELEGRAM_SESSION_FAILED",
        blockedAt: new Date().toISOString(),
        workerId: actorId ?? "worker",
        message: publicTelegramError(error),
      },
    };

    const blockedRun = await prisma.moduleRun.update({
      where: { id: run.id },
      data: {
        status: "BLOCKED_SETUP",
        resultJson: JSON.stringify(blockedResult),
        logsJson: appendRunLog(claimedRun.logsJson, "error", "Telegram session validation failed"),
        completedAt: new Date(),
      },
    });

    await logAudit({
      workspaceId: run.workspaceId,
      actorId,
      action: "module_run.telegram_session_failed",
      entity: "ModuleRun",
      entityId: run.id,
      metadata: { slug: run.moduleSlug, message: publicTelegramError(error) },
    });

    return blockedRun;
  }

  const dispatchedRun = await prisma.moduleRun.update({
    where: { id: run.id },
    data: {
      status: "WORKER_DISPATCHED",
      resultJson: JSON.stringify({
        ...existingResult,
        workerExecution,
        readiness: {
          executionMode: readiness.executionMode,
          readyForLive: readiness.readyForLive,
          missingRequirements: readiness.missingRequirements,
        },
      }),
      logsJson: appendRunLog(claimedRun.logsJson, "info", "Approved run dispatched by worker"),
      completedAt: new Date(),
    },
  });

  await logAudit({
    workspaceId: run.workspaceId,
    actorId,
    action: "module_run.worker_dispatched",
    entity: "ModuleRun",
    entityId: run.id,
    metadata: { slug: run.moduleSlug, actionCount: workerExecution.actionCount },
  });

  return dispatchedRun;
}

export async function createModuleRun(workspaceId: string, slug: string, input: ModuleInput, actorId?: string | null) {
  const queued = await queueModuleRun(workspaceId, slug, input, actorId);
  return processQueuedRun(queued.id, actorId);
}
