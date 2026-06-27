import { UnifiedInbox } from "@/components/unified-inbox";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

function publicConversation<T extends { tags: string }>(conversation: T) {
  return {
    ...conversation,
    tags: JSON.parse(conversation.tags),
  };
}

export default async function InboxPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
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

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Unified Inbox</h1>
          <p>{t(locale, "page.inbox.subtitle")}</p>
        </div>
      </div>
      <UnifiedInbox initialConversations={JSON.parse(JSON.stringify(conversations.map(publicConversation)))} />
    </>
  );
}
