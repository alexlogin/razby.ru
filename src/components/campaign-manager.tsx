"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { RazbyModule } from "@/lib/modules";

type Campaign = {
  id: string;
  name: string;
  moduleSlug: string;
  status: string;
  settings: Record<string, unknown>;
  createdAt: string;
};

export function CampaignManager({
  modules,
  initialCampaigns,
}: {
  modules: Array<Pick<RazbyModule, "slug" | "title">>;
  initialCampaigns: Campaign[];
}) {
  const { dateLocale, t } = useI18n();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [name, setName] = useState("");
  const [moduleSlug, setModuleSlug] = useState(modules[0]?.slug ?? "");
  const [targets, setTargets] = useState("@target_channel\n@target_chat");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        moduleSlug,
        settings: { targets },
      }),
    });
    const data = await response.json();
    setSaving(false);

    if (data.campaign) {
      setCampaigns((current) => [data.campaign, ...current]);
      setName("");
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>Campaigns</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Module</th>
              <th>Status</th>
              <th>Settings</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <strong>{campaign.name}</strong>
                </td>
                <td>{modules.find((module) => module.slug === campaign.moduleSlug)?.title ?? campaign.moduleSlug}</td>
                <td>
                  <span className="status warn">{campaign.status}</span>
                </td>
                <td className="muted">{Object.values(campaign.settings).join(" / ")}</td>
                <td>{new Date(campaign.createdAt).toLocaleString(dateLocale)}</td>
              </tr>
            ))}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t("campaigns.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <aside className="card">
        <h2>{t("campaigns.new")}</h2>
        <form className="form-grid" onSubmit={submit}>
          <label className="field full">
            <span>{t("campaigns.name")}</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="AI comments: crypto leads" />
          </label>
          <label className="field full">
            <span>{t("campaigns.module")}</span>
            <select className="select" value={moduleSlug} onChange={(event) => setModuleSlug(event.target.value)}>
              {modules.map((module) => (
                <option value={module.slug} key={module.slug}>
                  {module.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field full">
            <span>{t("campaigns.targets")}</span>
            <textarea className="textarea" value={targets} onChange={(event) => setTargets(event.target.value)} />
          </label>
          <button className="button" type="submit" disabled={saving || !name.trim()}>
            <Plus size={16} /> {saving ? t("campaigns.creating") : t("campaigns.create")}
          </button>
        </form>
      </aside>
    </div>
  );
}
