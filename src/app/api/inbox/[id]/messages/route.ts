import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getWorkspaceExecutionMode } from "@/lib/admin-settings";
import { getCurrentUser } from "@/lib/auth";
import { generateInboxDraft } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { publicTelegramError, sendTelegramTextMessage } from "@/lib/telegram-runner";
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
      telegramAccount: {
        select: { id: true, label: true, username: true, status: true },
      },
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

  let delivery: Awaited<ReturnType<typeof sendTelegramTextMessage>> | { mode: "simulate"; peer: string } | null = null;

  if (parsed.data.action === "APPROVE" || parsed.data.action === "SEND") {
    const latestDraft = [...conversation.messages].reverse().find((message) => message.status === "DRAFT");

    if (!latestDraft) {
      return NextResponse.json({ error: "No draft to update" }, { status: 400 });
    }

    const finalText = parsed.data.text || latestDraft.text;

    if (parsed.data.action === "SEND") {
      const executionMode = await getWorkspaceExecutionMode(workspace.id);

      if (executionMode === "live") {
        try {
          delivery = await sendTelegramTextMessage({
            workspaceId: workspace.id,
            peer: conversation.peerUsername,
            text: finalText,
            accountHint: conversation.telegramAccount?.username ?? conversation.telegramAccount?.label ?? null,
          });
        } catch (error) {
          return NextResponse.json({ error: `Telegram delivery failed: ${publicTelegramError(error)}` }, { status: 400 });
        }
      } else {
        delivery = { mode: "simulate", peer: conversation.peerUsername };
      }
    }

    await prisma.telegramMessage.update({
      where: { id: latestDraft.id },
      data: {
        text: finalText,
        aiDraft: latestDraft.aiDraft || latestDraft.text,
        status: parsed.data.action === "APPROVE" ? "APPROVED" : delivery?.mode === "live" ? "SENT_LIVE" : "SENT",
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
      deliveryMode: delivery?.mode ?? null,
    },
  });

  return NextResponse.json({ conversation: publicConversation(updated), delivery });
}
