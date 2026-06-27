"use client";

import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Integration = {
  id: string;
  service: string;
  label: string;
  status: string;
  lastCheckedAt?: string | Date | null;
};

const serviceFields = {
  "telegram-api": [
    ["apiId", "Telegram API ID"],
    ["apiHash", "Telegram API Hash"],
  ],
  "telegram-bot": [["botToken", "Bot token"]],
  "telegram-session": [
    ["username", "Telegram username"],
    ["phone", "Phone"],
    ["sessionString", "Session string"],
  ],
  "ai-provider": [
    ["provider", "Provider"],
    ["apiKey", "API key"],
    ["model", "Model"],
  ],
  worker: [["endpoint", "Worker endpoint"], ["workerSecret", "Worker secret"]],
} as const;

type Service = keyof typeof serviceFields;

export function IntegrationManager({ initialIntegrations }: { initialIntegrations: Integration[] }) {
  const { dateLocale, t } = useI18n();
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [service, setService] = useState<Service>("telegram-api");
  const [label, setLabel] = useState("primary");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, label, values }),
    });
    const data = await response.json();
    setSaving(false);

    if (data.integration) {
      setIntegrations((current) => [data.integration, ...current.filter((item) => item.id !== data.integration.id)]);
      setValues({});
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>
          <KeyRound size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
          Integrations
        </h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Label</th>
              <th>Status</th>
              <th>Checked</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => (
              <tr key={integration.id}>
                <td>{integration.service}</td>
                <td>{integration.label}</td>
                <td>
                  <span className="status">{integration.status}</span>
                </td>
                <td>{integration.lastCheckedAt ? new Date(integration.lastCheckedAt).toLocaleString(dateLocale) : "—"}</td>
              </tr>
            ))}
            {integrations.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  {t("integrations.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <aside className="card">
        <h2>{t("integrations.saveAccess")}</h2>
        <form className="form-grid" onSubmit={submit}>
          <label className="field full">
            <span>Service</span>
            <select className="select" value={service} onChange={(event) => setService(event.target.value as Service)}>
              <option value="telegram-api">Telegram API</option>
              <option value="telegram-bot">Telegram Bot</option>
              <option value="telegram-session">Telegram Session</option>
              <option value="ai-provider">AI Provider</option>
              <option value="worker">Worker</option>
            </select>
          </label>
          <label className="field full">
            <span>Label</span>
            <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          {serviceFields[service].map(([name, fieldLabel]) => (
            <label className="field full" key={name}>
              <span>{fieldLabel}</span>
              <input
                className="input"
                type="password"
                value={values[name] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
              />
            </label>
          ))}
          <button className="button" type="submit" disabled={saving}>
            <Save size={16} /> {saving ? t("integrations.saving") : t("integrations.save")}
          </button>
        </form>
      </aside>
    </div>
  );
}
