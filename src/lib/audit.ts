import { prisma } from "@/lib/prisma";

export async function logAudit(input: {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  });
}
