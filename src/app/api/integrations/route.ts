import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { encryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

const integrationSchema = z.object({
  service: z.enum(["telegram-api", "telegram-bot", "telegram-session", "ai-provider", "openrouter", "google-oauth", "worker"]),
  label: z.string().trim().min(2).max(64),
  values: z.record(z.string(), z.string().max(10000).optional()).default({}),
});

const allowedFields: Record<z.infer<typeof integrationSchema>["service"], Set<string>> = {
  "telegram-api": new Set(["apiId", "apiHash"]),
  "telegram-bot": new Set(["botToken"]),
  "telegram-session": new Set(["username", "phone", "sessionString"]),
  "ai-provider": new Set(["provider", "apiKey", "model", "baseUrl"]),
  openrouter: new Set(["apiKey", "model", "baseUrl"]),
  "google-oauth": new Set(["clientId", "clientSecret", "redirectUri"]),
  worker: new Set(["endpoint", "workerSecret"]),
};

const requiredFields: Record<z.infer<typeof integrationSchema>["service"], string[]> = {
  "telegram-api": ["apiId", "apiHash"],
  "telegram-bot": ["botToken"],
  "telegram-session": ["sessionString"],
  "ai-provider": ["apiKey"],
  openrouter: ["apiKey"],
  "google-oauth": ["clientId", "clientSecret"],
  worker: ["workerSecret"],
};

function maskSecret(value: string) {
  if (value.length <= 6) {
    return "***";
  }

  return `${value.slice(0, 3)}...${value.slice(-2)}`;
}

function publicSummary(values: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value ? maskSecret(value) : "",
    ]),
  );
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdminRequest(request, user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspace = await ensureWorkspace(user.id);
  const integrations = await prisma.integrationCredential.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ service: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    integrations: integrations.map((integration) => ({
      id: integration.id,
      service: integration.service,
      label: integration.label,
      status: integration.status,
      lastCheckedAt: integration.lastCheckedAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAdminRequest(request, user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = integrationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const fields = allowedFields[parsed.data.service];
  const cleanValues = Object.fromEntries(
    Object.entries(parsed.data.values)
      .filter(([key, value]) => fields.has(key) && value && value.trim().length > 0)
      .map(([key, value]) => [key, value!.trim()]),
  );

  if (Object.keys(cleanValues).length === 0) {
    return NextResponse.json({ error: "No valid credential fields supplied" }, { status: 400 });
  }

  const missing = requiredFields[parsed.data.service].filter((field) => !cleanValues[field]);

  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
  }

  const integration = await prisma.integrationCredential.upsert({
    where: {
      workspaceId_service_label: {
        workspaceId: workspace.id,
        service: parsed.data.service,
        label: parsed.data.label,
      },
    },
    update: {
      encryptedJson: encryptJson(cleanValues),
      status: "READY",
      lastCheckedAt: new Date(),
    },
    create: {
      workspaceId: workspace.id,
      service: parsed.data.service,
      label: parsed.data.label,
      encryptedJson: encryptJson(cleanValues),
      status: "READY",
      lastCheckedAt: new Date(),
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "integration.saved",
    entity: "IntegrationCredential",
    entityId: integration.id,
    metadata: {
      service: integration.service,
      label: integration.label,
      values: publicSummary(cleanValues),
    },
  });

  return NextResponse.json({
    integration: {
      id: integration.id,
      service: integration.service,
      label: integration.label,
      status: integration.status,
      lastCheckedAt: integration.lastCheckedAt,
    },
  });
}
