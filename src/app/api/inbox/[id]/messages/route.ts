import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { generateInboxDraft } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  action: z.enum(["INBOUND", "DRAFT", "APPROVE", "SEND"]),
  text: z.string().trim().max(4000).optional().default(""),
  persona: z.string().trim().max(120).optional().default("Razby operator"),
  handoffRule: z.string().trim().max(300).optional().default(""),
});

function publicConversation<T extends { tags: string }>(conversation: T) {
  return {
    ...conversation,
    tags: JSON.parse(conversation.tags),
  };
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = messageSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspace(user.id);
  const { id } = await params;
  const conversation = await prisma.telegramConversation.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (parsed.data.action === "INBOUND") {
    if (!parsed.data.text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    await prisma.telegramMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        authorUsername: conversation.peerUsername,
        text: parsed.data.text,
        status: "RECEIVED",
      },
    });

    const draft = await generateInboxDraft({
      workspaceId: workspace.id,
      peerTitle: conversation.peerTitle,
      latestMessage: parsed.data.text,
      persona: parsed.data.persona,
      handoffRule: parsed.data.handoffRule,
    });

    await prisma.telegramMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        authorUsername: "ai",
        text: draft.draft,
        aiDraft: draft.draft,
        status: "DRAFT",
      },
    });
  }

  if (parsed.data.action === "DRAFT") {
    const latestInbound = [...conversation.messages].reverse().find((message) => message.direction === "INBOUND");
    const draft = await generateInboxDraft({
      workspaceId: workspace.id,
      peerTitle: conversation.peerTitle,
      latestMessage: parsed.data.text || latestInbound?.text || "Нужен короткий ответ.",
      persona: parsed.data.persona,
      handoffRule: parsed.data.handoffRule,
    });

    await prisma.telegramMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        authorUsername: "ai",
        text: draft.draft,
        aiDraft: draft.draft,
        status: "DRAFT",
      },
    });
  }

  if (parsed.data.action === "APPROVE" || parsed.data.action === "SEND") {
    const latestDraft = [...conversation.messages].reverse().find((message) => message.status === "DRAFT");

    if (!latestDraft) {
      return NextResponse.json({ error: "No draft to update" }, { status: 400 });
    }

    await prisma.telegramMessage.update({
      where: { id: latestDraft.id },
      data: {
        text: parsed.data.text || latestDraft.text,
        aiDraft: latestDraft.aiDraft || latestDraft.text,
        status: parsed.data.action === "APPROVE" ? "APPROVED" : "SENT",
      },
    });
  }

  const updated = await prisma.telegramConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      status: parsed.data.action === "SEND" ? "HANDLED" : "OPEN",
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
    action: `inbox.message.${parsed.data.action.toLowerCase()}`,
    entity: "TelegramConversation",
    entityId: conversation.id,
    metadata: {
      peerUsername: conversation.peerUsername,
    },
  });

  return NextResponse.json({ conversation: publicConversation(updated) });
}
