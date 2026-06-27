import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { generateInboxDraft } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const conversationSchema = z.object({
  peerUsername: z.string().trim().min(2),
  peerTitle: z.string().trim().min(2),
  telegramAccountId: z.string().optional().nullable(),
  source: z.string().trim().max(80).optional().default("manual"),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional().default("NORMAL"),
  tags: z.array(z.string().trim().min(1).max(40)).optional().default([]),
  message: z.string().trim().min(1),
  persona: z.string().trim().max(120).optional().default("Razby operator"),
  handoffRule: z.string().trim().max(300).optional().default(""),
});

function publicConversation<T extends { tags: string; messages?: unknown[] }>(conversation: T) {
  return {
    ...conversation,
    tags: JSON.parse(conversation.tags),
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  const conversations = await prisma.telegramConversation.findMany({
    where: { workspaceId: workspace.id },
    include: {
      telegramAccount: {
        select: { id: true, label: true, username: true, status: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 30,
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 40,
  });

  return NextResponse.json({ conversations: conversations.map(publicConversation) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = conversationSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const draft = await generateInboxDraft({
    workspaceId: workspace.id,
    peerTitle: parsed.data.peerTitle,
    latestMessage: parsed.data.message,
    persona: parsed.data.persona,
    handoffRule: parsed.data.handoffRule,
  });

  const conversation = await prisma.telegramConversation.create({
    data: {
      workspaceId: workspace.id,
      telegramAccountId: parsed.data.telegramAccountId || null,
      peerUsername: parsed.data.peerUsername,
      peerTitle: parsed.data.peerTitle,
      source: parsed.data.source,
      priority: parsed.data.priority,
      tags: JSON.stringify(parsed.data.tags),
      messages: {
        create: [
          {
            direction: "INBOUND",
            authorUsername: parsed.data.peerUsername,
            text: parsed.data.message,
            status: "RECEIVED",
          },
          {
            direction: "OUTBOUND",
            authorUsername: "ai",
            text: draft.draft,
            aiDraft: draft.draft,
            status: "DRAFT",
          },
        ],
      },
    },
    include: {
      telegramAccount: {
        select: { id: true, label: true, username: true, status: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "inbox.conversation.created",
    entity: "TelegramConversation",
    entityId: conversation.id,
    metadata: {
      peerUsername: parsed.data.peerUsername,
      aiProvider: draft.provider,
    },
  });

  return NextResponse.json({ conversation: publicConversation(conversation), draft }, { status: 201 });
}
