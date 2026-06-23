"use client";

import { useState } from "react";
import { Activity, CheckCircle2, KeyRound, LockKeyhole, Save, ShieldCheck, ToggleRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { RuntimeAdminSettings } from "@/lib/admin-settings";

type Integration = {
  id: string;
  service: string;
  label: string;
  status: string;
  lastCheckedAt?: string | null;
};

type Readiness = {
  executionMode: string;
  readyForProduction: boolean;
  checks: Array<{
    key: string;
    label: string;
    state: "ready" | "warn" | "blocked";
    help: string;
  }>;
};

type AdminConsoleProps = {
  adminLocked: boolean;
  adminTokenConfigured: boolean;
  initialSettings: RuntimeAdminSettings;
  initialReadiness: Readiness | null;
  initialIntegrations: Integration[];
};

type ServiceField = {
  name: string;
  label: string;
  type?: "password" | "text";
  placeholder?: string;
};

const services = ["openrouter", "telegram-api", "telegram-session", "telegram-bot", "google-oauth", "worker", "ai-provider"] as const;

type Service = (typeof services)[number];

const serviceFields: Record<Service, ServiceField[]> = {
  openrouter: [
    { name: "apiKey", label: "OpenRouter API key", type: "password", placeholder: "sk-or-..." },
    { name: "model", label: "Default model", placeholder: "openai/gpt-4o-mini or your model id" },
    { name: "baseUrl", label: "Base URL", placeholder: "https://openrouter.ai/api/v1" },
  ],
  "telegram-api": [
    { name: "apiId", label: "Telegram API ID", type: "password" },
    { name: "apiHash", label: "Telegram API Hash", type: "password" },
  ],
  "telegram-session": [
    { name: "username", label: "Telegram username" },
    { name: "phone", label: "Phone" },
    { name: "sessionString", label: "Session string", type: "password" },
  ],
  "telegram-bot": [{ name: "botToken", label: "Bot token", type: "password" }],
  "google-oauth": [
    { name: "clientId", label: "Google Client ID", type: "password" },
    { name: "clientSecret", label: "Google Client Secret", type: "password" },
    { name: "redirectUri", label: "Redirect URI", placeholder: "https://your-domain/api/auth/callback/google" },
  ],
  worker: [
    { name: "endpoint", label: "Worker endpoint" },
    { name: "workerSecret", label: "Worker secret", type: "password" },
  ],
  "ai-provider": [
    { name: "provider", label: "Provider", placeholder: "openrouter / openai / anthropic" },
    { name: "apiKey", label: "API key", type: "password" },
    { name: "model", label: "Default model" },
    { name: "baseUrl", label: "Base URL" },
  ],
};

const adminCopy = {
  ru: {
    tokenError: "Токен не подошёл или RAZBY_ADMIN_TOKEN не настроен на сервере.",
    saveSettingsError: "Не удалось сохранить runtime-настройки.",
    saveIntegrationError: "Не удалось сохранить интеграцию.",
    testIntegrationError: "Не удалось проверить интеграцию.",
    lockedText: "На внешнем VPS demo-admin защищён bootstrap-token. На localhost админка открывается без токена.",
    missingToken: "На сервере не задан RAZBY_ADMIN_TOKEN. Добавьте его в .env и перезапустите контейнер.",
    alertChatPlaceholder: "@admin_chat или chat_id",
    liveAck: "Я понимаю, что live-режим начнёт реальные действия только после готовности Telegram/API/worker и approval-gates.",
    saving: "Сохраняю...",
    saveRuntime: "Сохранить runtime",
    saveAccess: "Сохранить доступ",
    testing: "Проверяю...",
    emptySecrets: "Секретов пока нет. Начните с OpenRouter API key.",
  },
  en: {
    tokenError: "Token did not match or RAZBY_ADMIN_TOKEN is not configured on the server.",
    saveSettingsError: "Could not save runtime settings.",
    saveIntegrationError: "Could not save integration.",
    testIntegrationError: "Could not test integration.",
    lockedText: "On the external VPS, demo admin is protected by a bootstrap token. On localhost it opens without a token.",
    missingToken: "RAZBY_ADMIN_TOKEN is not set on the server. Add it to .env and restart the container.",
    alertChatPlaceholder: "@admin_chat or chat_id",
    liveAck: "I understand live mode starts real actions only after Telegram/API/worker readiness and approval gates.",
    saving: "Saving...",
    saveRuntime: "Save runtime",
    saveAccess: "Save access",
    testing: "Testing...",
    emptySecrets: "No secrets yet. Start with an OpenRouter API key.",
  },
  es: {
    tokenError: "El token no coincide o RAZBY_ADMIN_TOKEN no está configurado en el servidor.",
    saveSettingsError: "No se pudieron guardar los ajustes runtime.",
    saveIntegrationError: "No se pudo guardar la integración.",
    testIntegrationError: "No se pudo probar la integración.",
    lockedText: "En el VPS externo, demo admin está protegido por bootstrap token. En localhost se abre sin token.",
    missingToken: "RAZBY_ADMIN_TOKEN no está definido en el servidor. Añádelo a .env y reinicia el contenedor.",
    alertChatPlaceholder: "@admin_chat o chat_id",
    liveAck: "Entiendo que live mode inicia acciones reales solo tras readiness de Telegram/API/worker y approval gates.",
    saving: "Guardando...",
    saveRuntime: "Guardar runtime",
    saveAccess: "Guardar acceso",
    testing: "Probando...",
    emptySecrets: "Aún no hay secretos. Empieza con una API key de OpenRouter.",
  },
  pt: {
    tokenError: "O token não confere ou RAZBY_ADMIN_TOKEN não está configurado no servidor.",
    saveSettingsError: "Não foi possível salvar as configurações runtime.",
    saveIntegrationError: "Não foi possível salvar a integração.",
    testIntegrationError: "Não foi possível testar a integração.",
    lockedText: "No VPS externo, demo admin é protegido por bootstrap token. No localhost abre sem token.",
    missingToken: "RAZBY_ADMIN_TOKEN não está definido no servidor. Adicione ao .env e reinicie o contêiner.",
    alertChatPlaceholder: "@admin_chat ou chat_id",
    liveAck: "Entendo que live mode inicia ações reais apenas após readiness de Telegram/API/worker e approval gates.",
    saving: "Salvando...",
    saveRuntime: "Salvar runtime",
    saveAccess: "Salvar acesso",
    testing: "Testando...",
    emptySecrets: "Ainda não há segredos. Comece com uma API key da OpenRouter.",
  },
};

const serviceLabels: Record<Service, string> = {
  openrouter: "OpenRouter",
  "telegram-api": "Telegram API",
  "telegram-session": "Telegram Session",
  "telegram-bot": "Telegram Bot",
  "google-oauth": "Google OAuth",
  worker: "Worker",
  "ai-provider": "Generic AI Provider",
};

const serviceDefaults: Record<Service, { label: string; values: Record<string, string> }> = {
  openrouter: {
    label: "openrouter",
    values: { baseUrl: "https://openrouter.ai/api/v1", model: "" },
  },
  "telegram-api": { label: "primary", values: {} },
  "telegram-session": { label: "main-session", values: {} },
  "telegram-bot": { label: "main-bot", values: {} },
  "google-oauth": { label: "production", values: {} },
  worker: { label: "vps-worker", values: {} },
  "ai-provider": { label: "primary-ai", values: {} },
};

export function AdminConsole({
  adminLocked,
  adminTokenConfigured,
  initialSettings,
  initialReadiness,
  initialIntegrations,
}: AdminConsoleProps) {
  const { locale } = useI18n();
  const copy = adminCopy[locale];
  const [settings, setSettings] = useState(initialSettings);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [service, setService] = useState<Service>("openrouter");
  const [label, setLabel] = useState(serviceDefaults.openrouter.label);
  const [values, setValues] = useState<Record<string, string>>(serviceDefaults.openrouter.values);
  const [adminToken, setAdminToken] = useState("");
  const [unlocked, setUnlocked] = useState(!adminLocked);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [testingIntegration, setTestingIntegration] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function requestHeaders() {
    return {
      "Content-Type": "application/json",
      ...(adminToken ? { "x-razby-admin-token": adminToken } : {}),
    };
  }

  function changeService(nextService: Service) {
    setService(nextService);
    setLabel(serviceDefaults[nextService].label);
    setValues(serviceDefaults[nextService].values);
  }

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const [settingsResponse, integrationsResponse] = await Promise.all([
      fetch("/api/admin/settings", { headers: requestHeaders() }),
      fetch("/api/integrations", { headers: requestHeaders() }),
    ]);

    if (!settingsResponse.ok || !integrationsResponse.ok) {
      setError(copy.tokenError);
      return;
    }

    const settingsData = await settingsResponse.json();
    const integrationsData = await integrationsResponse.json();
    setSettings(settingsData.settings);
    setReadiness(settingsData.readiness);
    setIntegrations(integrationsData.integrations ?? []);
    setUnlocked(true);
    setMessage("Admin unlocked.");
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    setSavingSettings(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : copy.saveSettingsError);
      return;
    }

    setSettings(data.settings);
    setReadiness(data.readiness);
    setMessage("Runtime settings saved.");
  }

  async function saveIntegration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingIntegration(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/integrations", {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ service, label, values }),
    });
    const data = await response.json();
    setSavingIntegration(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : copy.saveIntegrationError);
      return;
    }

    setIntegrations((current) => [data.integration, ...current.filter((item) => item.id !== data.integration.id)]);
    setValues(serviceDefaults[service].values);
    setMessage(`${serviceLabels[service]} saved.`);

    const readinessResponse = await fetch("/api/admin/settings", { headers: requestHeaders() });
    if (readinessResponse.ok) {
      const readinessData = await readinessResponse.json();
      setReadiness(readinessData.readiness);
    }
  }

  async function testIntegration() {
    setTestingIntegration(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/integrations/test", {
      method: "POST",
      headers: requestHeaders(),
      body: JSON.stringify({ service }),
    });
    const data = await response.json();
    setTestingIntegration(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : copy.testIntegrationError);
      return;
    }

    setMessage(`OpenRouter OK: ${data.result.model} · ${data.result.reply}`);
  }

  if (!unlocked) {
    return (
      <section className="card admin-lock">
        <span className="feature-icon">
          <LockKeyhole size={18} />
        </span>
        <div>
          <h2>Admin locked</h2>
          <p className="muted">{copy.lockedText}</p>
          {!adminTokenConfigured ? (
            <div className="notice">{copy.missingToken}</div>
          ) : (
            <form className="admin-unlock-form" onSubmit={unlock}>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="RAZBY_ADMIN_TOKEN"
              />
              <button className="button" type="submit" disabled={!adminToken.trim()}>
                <LockKeyhole size={16} /> Unlock
              </button>
            </form>
          )}
          {error ? <p className="notice">{error}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <div className="admin-grid">
      <section className="card admin-panel">
        <div className="card-title-row">
          <h2>
            <ToggleRight size={20} /> Runtime
          </h2>
          <span className={`status ${settings.executionMode === "live" ? "" : "warn"}`}>{settings.executionMode}</span>
        </div>
        <form className="form-grid" onSubmit={saveSettings}>
          <label className="field">
            <span>Execution mode</span>
            <select
              className="select"
              value={settings.executionMode}
              onChange={(event) => setSettings((current) => ({ ...current, executionMode: event.target.value as RuntimeAdminSettings["executionMode"] }))}
            >
              <option value="live">live</option>
              <option value="simulate">simulate</option>
            </select>
          </label>
          <label className="field">
            <span>Default approval</span>
            <select
              className="select"
              value={settings.defaultApproval}
              onChange={(event) => setSettings((current) => ({ ...current, defaultApproval: event.target.value as RuntimeAdminSettings["defaultApproval"] }))}
            >
              <option value="manual">manual</option>
              <option value="auto">auto</option>
            </select>
          </label>
          <label className="field">
            <span>Operator email</span>
            <input
              className="input"
              value={settings.operatorEmail}
              onChange={(event) => setSettings((current) => ({ ...current, operatorEmail: event.target.value }))}
              placeholder="owner@example.com"
            />
          </label>
          <label className="field">
            <span>Telegram alert chat</span>
            <input
              className="input"
              value={settings.telegramAlertChat}
              onChange={(event) => setSettings((current) => ({ ...current, telegramAlertChat: event.target.value }))}
              placeholder={copy.alertChatPlaceholder}
            />
          </label>
          <label className="field full checkbox-field">
            <input
              type="checkbox"
              checked={settings.liveSafetyAcknowledged}
              onChange={(event) => setSettings((current) => ({ ...current, liveSafetyAcknowledged: event.target.checked }))}
            />
            <span>{copy.liveAck}</span>
          </label>
          <button className="button" type="submit" disabled={savingSettings || (settings.executionMode === "live" && !settings.liveSafetyAcknowledged)}>
            <Save size={16} /> {savingSettings ? copy.saving : copy.saveRuntime}
          </button>
        </form>
      </section>

      <section className="card admin-panel">
        <div className="card-title-row">
          <h2>
            <KeyRound size={20} /> Secrets
          </h2>
          <span className="status">encrypted</span>
        </div>
        <form className="form-grid" onSubmit={saveIntegration}>
          <label className="field">
            <span>Service</span>
            <select className="select" value={service} onChange={(event) => changeService(event.target.value as Service)}>
              {Object.entries(serviceLabels).map(([value, title]) => (
                <option key={value} value={value}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Label</span>
            <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          {serviceFields[service].map((field) => (
            <label className="field full" key={field.name}>
              <span>{field.label}</span>
              <input
                className="input"
                type={field.type ?? "text"}
                autoComplete={field.type === "password" ? "new-password" : undefined}
                value={values[field.name] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              />
            </label>
          ))}
          <div className="form-actions">
            <button className="button" type="submit" disabled={savingIntegration || !label.trim()}>
              <Save size={16} /> {savingIntegration ? copy.saving : copy.saveAccess}
            </button>
            {service === "openrouter" ? (
              <button className="button secondary" type="button" onClick={testIntegration} disabled={testingIntegration}>
                <Activity size={16} /> {testingIntegration ? copy.testing : "Test OpenRouter"}
              </button>
            ) : null}
          </div>
        </form>
        <div className="secret-list">
          {integrations.map((integration) => (
            <div className="secret-row" key={integration.id}>
              <div>
                <strong>{serviceLabels[integration.service as Service] ?? integration.service}</strong>
                <span>{integration.label}</span>
              </div>
              <span className="status">{integration.status}</span>
            </div>
          ))}
          {integrations.length === 0 ? <p className="muted">{copy.emptySecrets}</p> : null}
        </div>
      </section>

      <section className="card admin-panel">
        <div className="card-title-row">
          <h2>
            <ShieldCheck size={20} /> Readiness
          </h2>
          <span className={`status ${readiness?.readyForProduction ? "" : "warn"}`}>{readiness?.readyForProduction ? "ready" : "needs setup"}</span>
        </div>
        <table className="data-table">
          <tbody>
            {readiness?.checks.map((check) => (
              <tr key={check.key}>
                <td>
                  <strong>{check.label}</strong>
                  <div className="muted small">{check.help}</div>
                </td>
                <td>
                  <span className={`status ${check.state === "blocked" ? "risk" : check.state === "warn" ? "warn" : ""}`}>{check.state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card admin-panel">
        <div className="card-title-row">
          <h2>
            <ShieldCheck size={20} /> Security
          </h2>
          <span className="status">guarded</span>
        </div>
        <div className="security-list">
          {[
            "Admin APIs are OWNER-only.",
            "Public demo-admin requires RAZBY_ADMIN_TOKEN outside localhost.",
            "Secrets are encrypted with AES-256-GCM and never rendered back.",
            "OpenRouter test returns only health metadata, never the API key.",
            "Audit log records admin changes without secret values.",
            "Live modules stay blocked until required integrations and worker are ready.",
          ].map((item) => (
            <span key={item}>
              <CheckCircle2 size={15} /> {item}
            </span>
          ))}
        </div>
        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice">{error}</p> : null}
      </section>
    </div>
  );
}
