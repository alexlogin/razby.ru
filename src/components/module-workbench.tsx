"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { ModuleField } from "@/lib/modules";

type ModuleWorkbenchProps = {
  slug: string;
  title: string;
  description: string;
  outcome: string;
  fields: ModuleField[];
  metrics: Array<{ label: string; value: string }>;
};

type RunResult = {
  id: string;
  moduleSlug: string;
  title: string;
  status: string;
  createdAt: string;
  result?: {
    summary?: string;
    stats?: Record<string, string | number | boolean>;
    rows?: Array<Record<string, string | number | boolean>>;
    policy?: {
      risk: string;
      approval: string;
      safeLimit: number;
      requires: string[];
    };
    nextActions?: string[];
    readiness?: {
      executionMode: string;
      readyForLive: boolean;
      missingRequirements: Array<{ key: string; label: string; state: string; help: string }>;
    };
  };
};

function initialValues(fields: ModuleField[]) {
  return fields.reduce<Record<string, string>>((values, field) => {
    values[field.name] = field.defaultValue ?? "";
    return values;
  }, {});
}

export function ModuleWorkbench({ slug, title, description, outcome, fields, metrics }: ModuleWorkbenchProps) {
  const { dateLocale, t } = useI18n();
  const [values, setValues] = useState(() => initialValues(fields));
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latestRun = runs[0];

  const statEntries = useMemo(() => {
    const stats = latestRun?.result?.stats ?? {};
    return Object.entries(stats).slice(0, 4);
  }, [latestRun]);

  function statusClass(status: string) {
    if (status.includes("BLOCKED") || status.includes("FAILED")) {
      return "status risk";
    }

    if (status.includes("RUNNING") || status.includes("QUEUED")) {
      return "status warn";
    }

    return "status";
  }

  async function loadRuns() {
    setRefreshing(true);
    const response = await fetch(`/api/modules/runs?module=${slug}`);
    const data = await response.json();
    setRuns(data.runs ?? []);
    setRefreshing(false);
  }

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submitRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/modules/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, input: values }),
    });
    const data = await response.json();
    setLoading(false);

    if (data.run) {
      setRuns((current) => [data.run, ...current]);
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>{t("module.setup")}</h2>
        <p className="muted">{description}</p>
        <form className="form-grid" onSubmit={submitRun} style={{ marginTop: 18 }}>
          {fields.map((field) => (
            <label className={`field ${field.type === "textarea" ? "full" : ""}`} key={field.name}>
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  className="textarea"
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              ) : field.type === "select" ? (
                <select
                  className="select"
                  value={values[field.name] ?? field.defaultValue ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  type={field.type}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              )}
            </label>
          ))}
          <div className="field full">
            <button className="button" type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} /> : <Play size={16} />}
              {t("module.run")}
            </button>
          </div>
        </form>
      </section>

      <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <section className="card">
          <h3>{t("module.expected")}</h3>
          <p className="muted">{outcome}</p>
          {latestRun?.result?.policy ? (
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              <span className={`status ${latestRun.result.policy.risk === "high" ? "risk" : latestRun.result.policy.risk === "medium" ? "warn" : ""}`}>
                risk: {latestRun.result.policy.risk}
              </span>
              <span className="muted small">approval: {latestRun.result.policy.approval}</span>
              <span className="muted small">safe limit: {latestRun.result.policy.safeLimit}</span>
            </div>
          ) : null}
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 16 }}>
            {metrics.map((metric) => (
              <div className="metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <h3>{t("module.latest")}</h3>
            <button className="button ghost" type="button" onClick={loadRuns} disabled={refreshing} aria-label="Refresh runs">
              <RefreshCw size={15} />
            </button>
          </div>
          {latestRun ? (
            <>
              <span className={statusClass(latestRun.status)}>{latestRun.status}</span>
              <p className="muted">{latestRun.result?.summary}</p>
              {latestRun.result?.readiness ? (
                <p className="muted small">
                  mode: {latestRun.result.readiness.executionMode} · {t("module.liveReady")}:{" "}
                  {latestRun.result.readiness.readyForLive ? "yes" : t("module.needsSetup")}
                </p>
              ) : null}
              {statEntries.length > 0 ? (
                <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {statEntries.map(([key, value]) => (
                    <div className="stat" key={key}>
                      <span>{key}</span>
                      <strong>{String(value)}</strong>
                    </div>
              ))}
            </div>
          ) : null}
              {latestRun.result?.nextActions?.length ? (
                <div style={{ marginTop: 14 }}>
                  <strong>{t("module.nextActions")}</strong>
                  <ul className="muted">
                    {latestRun.result.nextActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">{t("module.noRuns")}</p>
          )}
        </section>
      </aside>

      <section className="card" style={{ gridColumn: "1 / -1" }}>
        <h2>{t("module.history", { title })}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("module.time")}</th>
              <th>{t("dashboard.status")}</th>
              <th>{t("module.summary")}</th>
              <th>{t("module.firstRows")}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{new Date(run.createdAt).toLocaleString(dateLocale)}</td>
                <td>
                  <span className={statusClass(run.status)}>{run.status}</span>
                </td>
                <td>{run.result?.summary ?? t("common.noResult")}</td>
                <td className="muted">
                  {(run.result?.rows ?? [])
                    .slice(0, 2)
                    .map((row) => Object.values(row).slice(0, 3).join(" / "))
                    .join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
