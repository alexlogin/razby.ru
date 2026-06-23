import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { createModuleRun } from "@/lib/module-engine";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

const scenarioSchema = z.object({
  name: z.string().min(2),
  offer: z.string().min(8),
  channelLink: z.string().min(3),
  trafficSource: z.string().min(2),
  accountPersona: z.string().min(2),
  accountCount: z.coerce.number().int().min(1).max(500),
  proxyStrategy: z.string().min(2),
  keywords: z.string().min(2),
  seedSources: z.string().optional().default(""),
  minMembers: z.coerce.number().int().min(100).max(1000000),
  language: z.string().min(2),
  activeOnly: z.string().min(2),
  prompt: z.string().min(10),
  responseProbability: z.coerce.number().min(1).max(100),
  contextMessages: z.coerce.number().int().min(1).max(50),
  maxReplies: z.coerce.number().int().min(1).max(20),
  stopAfterLink: z.string().min(2),
  approval: z.string().min(2),
});

function readRunResult(run: { resultJson: string | null }) {
  return run.resultJson ? JSON.parse(run.resultJson) : null;
}

function publicRun(run: {
  id: string;
  moduleSlug: string;
  status: string;
  resultJson: string | null;
}) {
  const result = readRunResult(run);

  return {
    id: run.id,
    moduleSlug: run.moduleSlug,
    status: run.status,
    summary: result?.summary ?? null,
    stats: result?.stats ?? {},
    nextActions: result?.nextActions ?? [],
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = scenarioSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const scenario = parsed.data;
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      moduleSlug: "neurochatting",
      name: scenario.name,
      status: "DRAFT",
      settingsJson: JSON.stringify({
        scenario: true,
        ...scenario,
      }),
    },
  });

  const parserRun = await createModuleRun(
    workspace.id,
    "channel-parser",
    {
      keywords: scenario.keywords,
      category: "Все",
      seedSources: scenario.seedSources,
      minMembers: scenario.minMembers,
      language: scenario.language,
      activeOnly: scenario.activeOnly,
    },
    user.id,
  );

  const chatRun = await createModuleRun(
    workspace.id,
    "neurochatting",
    {
      chats: scenario.seedSources || scenario.keywords,
      persona: scenario.accountPersona,
      prompt: scenario.prompt,
      offer: scenario.offer,
      trafficSource: scenario.trafficSource,
      accountCount: scenario.accountCount,
      proxyStrategy: scenario.proxyStrategy,
      languageMode: scenario.language,
      contextMessages: scenario.contextMessages,
      responseProbability: scenario.responseProbability,
      maxReplies: scenario.maxReplies,
      handoffLink: scenario.channelLink,
      stopAfterLink: scenario.stopAfterLink,
      approval: scenario.approval,
    },
    user.id,
  );

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "scenario.created",
    entity: "Campaign",
    entityId: campaign.id,
    metadata: {
      campaignId: campaign.id,
      parserRunId: parserRun.id,
      chatRunId: chatRun.id,
      source: "workflow",
    },
  });

  return NextResponse.json({
    campaign: {
      ...campaign,
      settings: JSON.parse(campaign.settingsJson),
      createdAt: campaign.createdAt.toISOString(),
    },
    runs: [publicRun(parserRun), publicRun(chatRun)],
    nextActions: [
      "Проверить найденные источники и исключить нерелевантные чаты.",
      "Одобрить первые AI-черновики перед live-публикацией.",
      "Подключить Telegram API, аккаунты, AI provider и worker для production-режима.",
      "После первых лидов обновить оффер и промпт по конверсии.",
    ],
  });
}
