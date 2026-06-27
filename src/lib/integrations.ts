import { decryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export type IntegrationValues = Record<string, string>;

export async function getIntegrationValues(workspaceId: string, services: string[]) {
  const integration = await prisma.integrationCredential.findFirst({
    where: {
      workspaceId,
      service: { in: services },
      status: { in: ["READY", "SAVED"] },
    },
    orderBy: [{ service: "asc" }, { updatedAt: "desc" }],
  });

  if (!integration) {
    return null;
  }

  return {
    id: integration.id,
    service: integration.service,
    label: integration.label,
    values: decryptJson<IntegrationValues>(integration.encryptedJson),
  };
}

export async function getOpenRouterIntegration(workspaceId: string) {
  const integrations = await prisma.integrationCredential.findMany({
    where: {
      workspaceId,
      service: { in: ["openrouter", "ai-provider"] },
      status: { in: ["READY", "SAVED"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  const integration =
    integrations.find((item) => item.service === "openrouter") ??
    integrations.find((item) => {
      const values = decryptJson<IntegrationValues>(item.encryptedJson);
      return values.provider?.toLowerCase() === "openrouter";
    });

  if (!integration) {
    return null;
  }

  const values = decryptJson<IntegrationValues>(integration.encryptedJson);
  const provider = values.provider?.toLowerCase() ?? integration.service;

  if (integration.service === "ai-provider" && provider !== "openrouter") {
    return null;
  }

  return {
    id: integration.id,
    label: integration.label,
    apiKey: values.apiKey,
    baseUrl: values.baseUrl || "https://openrouter.ai/api/v1",
    model: values.model || "openai/gpt-4o-mini",
  };
}
