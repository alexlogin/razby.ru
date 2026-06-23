"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Approval = {
  id: string;
  kind: string;
  title: string;
  status: string;
  risk: string;
  createdAt: string;
  decidedAt?: string | null;
  payload: {
    moduleSlug?: string;
    moduleTitle?: string;
    summary?: string;
    rows?: Array<Record<string, string | number | boolean>>;
    nextActions?: string[];
  };
  decision?: {
    action: string;
    note?: string;
    actorEmail?: string;
  } | null;
  moduleRun?: {
    status: string;
    title: string;
  } | null;
};

const filters = ["PENDING", "APPROVED", "REJECTED", "NEEDS_REVISION", "ALL"];

function riskClass(risk: string) {
  if (risk === "high") {
    return "status risk";
  }

  if (risk === "medium") {
    return "status warn";
  }

  return "status";
}

export function ApprovalQueue({ initialApprovals }: { initialApprovals: Approval[] }) {
  const { dateLocale, t } = useI18n();
  const [approvals, setApprovals] = useState(initialApprovals);
  const [filter, setFilter] = useState("PENDING");
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const visibleApprovals = useMemo(() => {
    if (filter === "ALL") {
      return approvals;
    }

    return approvals.filter((approval) => approval.status === filter);
  }, [approvals, filter]);

  async function refresh(nextFilter = filter) {
    const response = await fetch(`/api/approvals?status=${nextFilter}`);
    const data = await response.json();
    setApprovals(data.approvals ?? []);
  }

  async function decide(id: string, action: "APPROVED" | "REJECTED" | "NEEDS_REVISION") {
    setBusyId(id);
    setMessage("");
    const response = await fetch(`/api/approvals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note[id] ?? "" }),
    });
    const data = await response.json();
    setBusyId(null);

    if (!response.ok) {
      setMessage(typeof data.error === "string" ? data.error : t("approvals.err"));
      return;
    }

    setApprovals((current) => current.map((approval) => (approval.id === id ? data.approval : approval)));
    setMessage(t("approvals.saved"));
  }

  return (
    <div className="approval-layout">
      <section className="card">
        <div className="card-title-row">
          <h2>{t("approvals.queue")}</h2>
          <span className="status warn">{t("approvals.pending", { count: approvals.filter((item) => item.status === "PENDING").length })}</span>
        </div>
        <div className="tab-row">
          {filters.map((item) => (
            <button
              className={`tab-button ${filter === item ? "active" : ""}`}
              key={item}
              type="button"
              onClick={() => {
                setFilter(item);
                refresh(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        {message ? <div className={message.includes("Не удалось") ? "notice" : "notice success"}>{message}</div> : null}
        <div className="approval-list">
          {visibleApprovals.map((approval) => (
            <article className="approval-card" key={approval.id}>
              <div className="approval-head">
                <div>
                  <div className="pill-row">
                    <span className={riskClass(approval.risk)}>{approval.risk}</span>
                    <span className="pill">{approval.kind}</span>
                    <span className="pill">{approval.status}</span>
                  </div>
                  <h3>{approval.title}</h3>
                  <p className="muted">{approval.payload.summary ?? t("approvals.fallback")}</p>
                </div>
                <div className="approval-time">
                  <Clock3 size={15} />
                  {new Date(approval.createdAt).toLocaleString(dateLocale)}
                </div>
              </div>

              {approval.payload.rows?.length ? (
                <div className="approval-preview">
                  {approval.payload.rows.slice(0, 3).map((row, index) => (
                    <div className="approval-row" key={index}>
                      {Object.entries(row)
                        .slice(0, 4)
                        .map(([key, value]) => (
                          <span key={key}>
                            <strong>{key}</strong>
                            {String(value)}
                          </span>
                        ))}
                    </div>
                  ))}
                </div>
              ) : null}

              {approval.payload.nextActions?.length ? (
                <div className="check-list compact-list">
                  {approval.payload.nextActions.slice(0, 4).map((action) => (
                    <span key={action}>
                      <CheckCircle2 size={15} /> {action}
                    </span>
                  ))}
                </div>
              ) : null}

              {approval.status === "PENDING" ? (
                <div className="approval-actions">
                  <input
                    className="input"
                    placeholder={t("approvals.note")}
                    value={note[approval.id] ?? ""}
                    onChange={(event) => setNote((current) => ({ ...current, [approval.id]: event.target.value }))}
                  />
                  <button className="button" disabled={busyId === approval.id} type="button" onClick={() => decide(approval.id, "APPROVED")}>
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button className="button secondary" disabled={busyId === approval.id} type="button" onClick={() => decide(approval.id, "NEEDS_REVISION")}>
                    <RotateCcw size={16} /> Revise
                  </button>
                  <button className="button ghost danger-button" disabled={busyId === approval.id} type="button" onClick={() => decide(approval.id, "REJECTED")}>
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              ) : (
                <div className="muted small">
                  {t("approvals.decision")}: {approval.decision?.action ?? approval.status}
                  {approval.decision?.note ? ` · ${approval.decision.note}` : ""}
                </div>
              )}
            </article>
          ))}
          {visibleApprovals.length === 0 ? <p className="muted">{t("approvals.empty")}</p> : null}
        </div>
      </section>

      <aside className="card">
        <h2>{t("approvals.how")}</h2>
        <div className="check-list">
          <span>
            <CheckCircle2 size={15} /> {t("approvals.rule1")}
          </span>
          <span>
            <CheckCircle2 size={15} /> {t("approvals.rule2")}
          </span>
          <span>
            <CheckCircle2 size={15} /> {t("approvals.rule3")}
          </span>
          <span>
            <CheckCircle2 size={15} /> {t("approvals.rule4")}
          </span>
        </div>
      </aside>
    </div>
  );
}
