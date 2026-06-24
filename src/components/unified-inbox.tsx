"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type InboxMessage = {
  id: string;
  direction: string;
  authorUsername?: string | null;
  text: string;
  aiDraft?: string | null;
  status: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  peerUsername: string;
  peerTitle: string;
  source: string;
  status: string;
  priority: string;
  tags: string[];
  lastMessageAt: string;
  messages: InboxMessage[];
  telegramAccount?: {
    label: string;
    username: string;
    status: string;
  } | null;
};

function messageClass(message: InboxMessage) {
  return message.direction === "OUTBOUND" ? "inbox-message outbound" : "inbox-message inbound";
}

export function UnifiedInbox({ initialConversations }: { initialConversations: Conversation[] }) {
  const { dateLocale, t } = useI18n();
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState(initialConversations[0]?.id ?? "");
  const [newLead, setNewLead] = useState({
    peerUsername: "@lead_demo",
    peerTitle: "Lead demo",
    message: "Здравствуйте, интересует продвижение Telegram-канала. Что можете предложить?",
    persona: "Эксперт по росту Telegram",
    handoffRule: "Если человек просит цену или созвон, передай оператору.",
  });
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0],
    [conversations, selectedId],
  );

  function upsertConversation(conversation: Conversation) {
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
    setSelectedId(conversation.id);
    const latestDraft = [...conversation.messages].reverse().find((item) => item.status === "DRAFT");
    setReplyText(latestDraft?.text ?? "");
  }

  async function createConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newLead,
        source: "manual-test",
        priority: "NORMAL",
        tags: ["demo", "lead"],
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(t("inbox.errCreate"));
      return;
    }

    upsertConversation(data.conversation);
    setMessage(data.draft?.provider === "openrouter" ? t("inbox.msgOpenrouter") : t("inbox.msgLocal"));
  }

  async function conversationAction(action: "INBOUND" | "DRAFT" | "APPROVE" | "SEND") {
    if (!selected) {
      return;
    }

    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/inbox/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        text: action === "INBOUND" ? newLead.message : replyText,
        persona: newLead.persona,
        handoffRule: newLead.handoffRule,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : t("inbox.errUpdate"));
      return;
    }

    upsertConversation(data.conversation);

    if (action === "SEND" && data.delivery?.mode === "live") {
      setMessage(`Telegram sent: ${data.delivery.peer}`);
      return;
    }

    setMessage(action === "SEND" ? t("inbox.msgSent") : t("inbox.msgUpdated"));
  }

  return (
    <div className="inbox-layout">
      <section className="card inbox-compose">
        <h2>
          <MessageSquarePlus size={19} /> {t("inbox.new")}
        </h2>
        <form className="form-grid" onSubmit={createConversation}>
          <label className="field">
            <span>Username</span>
            <input className="input" value={newLead.peerUsername} onChange={(event) => setNewLead((current) => ({ ...current, peerUsername: event.target.value }))} />
          </label>
          <label className="field">
            <span>{t("inbox.name")}</span>
            <input className="input" value={newLead.peerTitle} onChange={(event) => setNewLead((current) => ({ ...current, peerTitle: event.target.value }))} />
          </label>
          <label className="field full">
            <span>{t("inbox.message")}</span>
            <textarea className="textarea compact" value={newLead.message} onChange={(event) => setNewLead((current) => ({ ...current, message: event.target.value }))} />
          </label>
          <label className="field">
            <span>{t("inbox.persona")}</span>
            <input className="input" value={newLead.persona} onChange={(event) => setNewLead((current) => ({ ...current, persona: event.target.value }))} />
          </label>
          <label className="field">
            <span>Handoff rule</span>
            <input className="input" value={newLead.handoffRule} onChange={(event) => setNewLead((current) => ({ ...current, handoffRule: event.target.value }))} />
          </label>
          <div className="form-actions">
            <button className="button" disabled={busy} type="submit">
              <Sparkles size={16} /> {t("inbox.create")}
            </button>
          </div>
        </form>
        {message ? <div className={message.includes("Не удалось") ? "notice" : "notice success"}>{message}</div> : null}
      </section>

      <div className="inbox-main">
        <aside className="card inbox-list">
          <h2>{t("inbox.dialogs")}</h2>
          {conversations.map((conversation) => {
            const last = conversation.messages[conversation.messages.length - 1];
            return (
              <button
                className={`conversation-item ${selected?.id === conversation.id ? "active" : ""}`}
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  const latestDraft = [...conversation.messages].reverse().find((item) => item.status === "DRAFT");
                  setReplyText(latestDraft?.text ?? "");
                }}
              >
                <span>
                  <strong>{conversation.peerTitle}</strong>
                  <small>{conversation.peerUsername} · {conversation.status}</small>
                </span>
                <em>{last?.text.slice(0, 82) ?? t("inbox.noMessages")}</em>
              </button>
            );
          })}
          {conversations.length === 0 ? <p className="muted">{t("inbox.empty")}</p> : null}
        </aside>

        <section className="card inbox-thread">
          {selected ? (
            <>
              <div className="card-title-row">
                <div>
                  <h2>{selected.peerTitle}</h2>
                  <p className="muted small">
                    {selected.peerUsername} · {selected.priority} · {new Date(selected.lastMessageAt).toLocaleString(dateLocale)}
                  </p>
                </div>
                <span className={`status ${selected.status === "OPEN" ? "warn" : ""}`}>{selected.status}</span>
              </div>

              <div className="message-stack">
                {selected.messages.map((item) => (
                  <div className={messageClass(item)} key={item.id}>
                    <span>
                      {item.direction === "OUTBOUND" ? <Bot size={14} /> : <MessageSquarePlus size={14} />}
                      {item.status}
                    </span>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="reply-box">
                <label className="field full">
                  <span>{t("inbox.reply")}</span>
                  <textarea className="textarea compact" value={replyText} onChange={(event) => setReplyText(event.target.value)} />
                </label>
                <div className="form-actions">
                  <button className="button secondary" disabled={busy} type="button" onClick={() => conversationAction("DRAFT")}>
                    <Sparkles size={16} /> {t("inbox.newDraft")}
                  </button>
                  <button className="button secondary" disabled={busy || !replyText.trim()} type="button" onClick={() => conversationAction("APPROVE")}>
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button className="button" disabled={busy || !replyText.trim()} type="button" onClick={() => conversationAction("SEND")}>
                    <Send size={16} /> {t("inbox.markSent")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="muted">{t("inbox.choose")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
