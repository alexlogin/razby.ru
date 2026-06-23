"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Account = {
  id: string;
  label: string;
  username: string;
  phone?: string | null;
  status: string;
  healthScore: number;
  ggrScore: number;
  proxy?: string | null;
  notes?: string | null;
};

export function AccountManager({ initialAccounts }: { initialAccounts: Account[] }) {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState({
    label: "",
    username: "",
    phone: "",
    proxy: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(false);

    if (data.account) {
      setAccounts((current) => [data.account, ...current]);
      setForm({ label: "", username: "", phone: "", proxy: "", notes: "" });
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>Telegram accounts</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Username</th>
              <th>Status</th>
              <th>Health</th>
              <th>GGR</th>
              <th>Proxy</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <strong>{account.label}</strong>
                  <div className="muted small">{account.notes}</div>
                </td>
                <td>{account.username}</td>
                <td>
                  <span className={`status ${account.status === "RISK" ? "risk" : account.status === "WARMING" ? "warn" : ""}`}>
                    {account.status}
                  </span>
                </td>
                <td>{account.healthScore}%</td>
                <td>{account.ggrScore.toFixed(1)}</td>
                <td>{account.proxy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <aside className="card">
        <h2>{t("accounts.add")}</h2>
        <form className="form-grid" onSubmit={submit}>
          {[
            ["label", t("accounts.name"), "Core worker 21"],
            ["username", "Username", "@worker_21"],
            ["phone", t("accounts.phone"), "+10000000021"],
            ["proxy", t("accounts.proxy"), "EU pool"],
          ].map(([name, label, placeholder]) => (
            <label className="field full" key={name}>
              <span>{label}</span>
              <input
                className="input"
                placeholder={placeholder}
                value={form[name as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
              />
            </label>
          ))}
          <label className="field full">
            <span>{t("accounts.notes")}</span>
            <textarea
              className="textarea"
              placeholder={t("accounts.notesPlaceholder")}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          <button className="button" type="submit" disabled={saving}>
            <Plus size={16} /> {saving ? t("accounts.saving") : t("accounts.addButton")}
          </button>
        </form>
      </aside>
    </div>
  );
}
