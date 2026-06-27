import { prisma } from "@/lib/prisma";

type ApprovalPayload = {
  moduleSlug: string;
  moduleTitle: string;
  summary?: string;
  policy?: {
    risk?: string;
    approval?: string;
    safeLimit?: number;
  };
  rows?: unknown[];
  nextActions?: string[];
};

function resultObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function needsHumanApproval(result: unknown) {
  const object = resultObject(result);
  const policy = resultObject(object.policy);
  const approval = String(policy.approval ?? "auto");
  return approval === "manual" || approval === "required";
}

export function approvalRisk(result: unknown) {
  const object = resultObject(result);
  const policy = resultObject(object.policy);
  return String(policy.risk ?? "medium");
}

export async function createRunApproval(input: {
  workspaceId: string;
  moduleRunId: string;
  moduleSlug: string;
  moduleTitle: string;
  result: unknown;
}) {
  if (!needsHumanApproval(input.result)) {
    return null;
  }

  const object = resultObject(input.result);
  const payload: ApprovalPayload = {
    moduleSlug: input.moduleSlug,
    moduleTitle: input.moduleTitle,
    summary: typeof object.summary === "string" ? object.summary : undefined,
    policy: resultObject(object.policy) as ApprovalPayload["policy"],
    rows: Array.isArray(object.rows) ? object.rows.slice(0, 20) : [],
    nextActions: Array.isArray(object.nextActions) ? object.nextActions.map(String) : [],
  };

  return prisma.approvalItem.create({
    data: {
      workspaceId: input.workspaceId,
      moduleRunId: input.moduleRunId,
      kind: input.moduleSlug.startsWith("neuro") || input.moduleSlug === "unified-inbox" ? "AI_DRAFTS" : "WORKER_ACTIONS",
      title: `${input.moduleTitle}: approval required`,
      risk: approvalRisk(input.result),
      payloadJson: JSON.stringify(payload),
    },
  });
}

export function publicApproval<T extends { payloadJson: string; decisionJson: string | null }>(approval: T) {
  return {
    ...approval,
    payload: JSON.parse(approval.payloadJson),
    decision: approval.decisionJson ? JSON.parse(approval.decisionJson) : null,
    payloadJson: undefined,
    decisionJson: undefined,
  };
}
