"use client";

import { useState } from "react";
import { KeyRound, Plus, RotateCcw, Send, ShieldCheck, Smartphone } from "lucide-react";
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

type TelegramAuth = {
  id: string;
  label: string;
  phone: string;
  status: string;
  isCodeViaApp: boolean;
  expiresAt: string;
};

const connectCopy = {
  ru: {
    title: "Подключить Telegram",
    subtitle: "Платформа сама запросит код Telegram, сохранит session string и создаст рабочий аккаунт.",
    label: "Название аккаунта",
    phone: "Телефон Telegram",
    forceSms: "Запросить SMS вместо кода в приложении",
    sendCode: "Получить код",
    codeTitle: "Код из Telegram",
    codeHelpApp: "Код отправлен в Telegram-приложение. Сессия истечет через 10 минут.",
    codeHelpSms: "Код отправлен по SMS. Сессия истечет через 10 минут.",
    verifyCode: "Подтвердить код",
    passwordTitle: "Cloud password / 2FA",
    passwordHelp: "Telegram запросил пароль облачной двухфакторной защиты.",
    finish: "Завершить подключение",
    connected: "Telegram аккаунт подключен и session сохранена.",
    reset: "Начать заново",
    working: "Подключаю...",
  },
  en: {
    title: "Connect Telegram",
    subtitle: "Razby requests the Telegram code, saves the session string, and creates a working account.",
    label: "Account label",
    phone: "Telegram phone",
    forceSms: "Request SMS instead of app code",
    sendCode: "Get code",
    codeTitle: "Telegram code",
    codeHelpApp: "The code was sent to the Telegram app. This session expires in 10 minutes.",
    codeHelpSms: "The code was sent by SMS. This session expires in 10 minutes.",
    verifyCode: "Verify code",
    passwordTitle: "Cloud password / 2FA",
    passwordHelp: "Telegram requested the account cloud password.",
    finish: "Finish connection",
    connected: "Telegram account connected and session saved.",
    reset: "Start again",
    working: "Connecting...",
  },
  es: {
    title: "Conectar Telegram",
    subtitle: "Razby solicita el código, guarda la session string y crea una cuenta operativa.",
    label: "Etiqueta de cuenta",
    phone: "Teléfono Telegram",
    forceSms: "Solicitar SMS en vez de código en app",
    sendCode: "Obtener código",
    codeTitle: "Código Telegram",
    codeHelpApp: "El código fue enviado a la app de Telegram. La sesión expira en 10 minutos.",
    codeHelpSms: "El código fue enviado por SMS. La sesión expira en 10 minutos.",
    verifyCode: "Verificar código",
    passwordTitle: "Cloud password / 2FA",
    passwordHelp: "Telegram solicitó la contraseña cloud de la cuenta.",
    finish: "Finalizar conexión",
    connected: "Cuenta Telegram conectada y sesión guardada.",
    reset: "Empezar de nuevo",
    working: "Conectando...",
  },
  pt: {
    title: "Conectar Telegram",
    subtitle: "Razby solicita o código, salva a session string e cria uma conta operacional.",
    label: "Rótulo da conta",
    phone: "Telefone Telegram",
    forceSms: "Solicitar SMS em vez de código no app",
    sendCode: "Obter código",
    codeTitle: "Código Telegram",
    codeHelpApp: "O código foi enviado ao app Telegram. A sessão expira em 10 minutos.",
    codeHelpSms: "O código foi enviado por SMS. A sessão expira em 10 minutos.",
    verifyCode: "Verificar código",
    passwordTitle: "Cloud password / 2FA",
    passwordHelp: "Telegram solicitou a senha cloud da conta.",
    finish: "Finalizar conexão",
    connected: "Conta Telegram conectada e sessão salva.",
    reset: "Começar de novo",
    working: "Conectando...",
  },
};

export function AccountManager({ initialAccounts }: { initialAccounts: Account[] }) {
  const { locale, t } = useI18n();
  const copy = connectCopy[locale];
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState({
    label: "",
    username: "",
    phone: "",
    proxy: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [connectStep, setConnectStep] = useState<"phone" | "code" | "password">("phone");
  const [connectAuth, setConnectAuth] = useState<TelegramAuth | null>(null);
  const [connectForm, setConnectForm] = useState({
    label: "main-session",
    phone: "",
    code: "",
    password: "",
    forceSms: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState("");
  const [connectError, setConnectError] = useState("");

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

  function resetConnect() {
    setConnectStep("phone");
    setConnectAuth(null);
    setConnectForm({ label: "main-session", phone: "", code: "", password: "", forceSms: false });
    setConnectMessage("");
    setConnectError("");
  }

  function upsertAccount(account: Account) {
    setAccounts((current) => [account, ...current.filter((item) => item.id !== account.id)]);
  }

  async function startConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnecting(true);
    setConnectError("");
    setConnectMessage("");

    const response = await fetch("/api/telegram/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: connectForm.label,
        phone: connectForm.phone,
        forceSms: connectForm.forceSms,
      }),
    });
    const data = await response.json();
    setConnecting(false);

    if (!response.ok) {
      setConnectError(typeof data.error === "string" ? data.error : "Telegram connect failed");
      return;
    }

    setConnectAuth(data.auth);
    setConnectStep("code");
    setConnectMessage(data.auth?.isCodeViaApp ? copy.codeHelpApp : copy.codeHelpSms);
  }

  async function verifyConnect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!connectAuth) {
      return;
    }

    setConnecting(true);
    setConnectError("");
    setConnectMessage("");

    const response = await fetch("/api/telegram/connect/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authSessionId: connectAuth.id,
        code: connectStep === "code" ? connectForm.code : undefined,
        password: connectStep === "password" ? connectForm.password : undefined,
      }),
    });
    const data = await response.json();
    setConnecting(false);

    if (!response.ok) {
      setConnectError(typeof data.error === "string" ? data.error : "Telegram verification failed");
      return;
    }

    if (data.requiresPassword) {
      setConnectAuth(data.auth);
      setConnectStep("password");
      setConnectMessage(copy.passwordHelp);
      return;
    }

    if (data.account) {
      upsertAccount(data.account);
      setConnectStep("phone");
      setConnectAuth(null);
      setConnectForm({ label: "main-session", phone: "", code: "", password: "", forceSms: false });
      setConnectMessage(copy.connected);
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
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No Telegram accounts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <aside className="account-side-panel">
        <section className="card account-connect-card">
          <div className="card-title-row">
            <h2>
              <Smartphone size={20} /> {copy.title}
            </h2>
            <span className={`status ${connectStep === "phone" ? "warn" : ""}`}>{connectStep}</span>
          </div>
          <p className="muted small">{copy.subtitle}</p>

          {connectStep === "phone" ? (
            <form className="form-grid" onSubmit={startConnect}>
              <label className="field full">
                <span>{copy.label}</span>
                <input
                  className="input"
                  value={connectForm.label}
                  placeholder="main-session"
                  onChange={(event) => setConnectForm((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              <label className="field full">
                <span>{copy.phone}</span>
                <input
                  className="input"
                  value={connectForm.phone}
                  placeholder="+79990000000"
                  onChange={(event) => setConnectForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <label className="field full checkbox-field">
                <input
                  type="checkbox"
                  checked={connectForm.forceSms}
                  onChange={(event) => setConnectForm((current) => ({ ...current, forceSms: event.target.checked }))}
                />
                <span>{copy.forceSms}</span>
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={connecting || !connectForm.label.trim() || !connectForm.phone.trim()}>
                  <Send size={16} /> {connecting ? copy.working : copy.sendCode}
                </button>
              </div>
            </form>
          ) : null}

          {connectStep === "code" && connectAuth ? (
            <form className="form-grid" onSubmit={verifyConnect}>
              <label className="field full">
                <span>{copy.codeTitle}</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={connectForm.code}
                  placeholder="12345"
                  onChange={(event) => setConnectForm((current) => ({ ...current, code: event.target.value }))}
                />
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={connecting || !connectForm.code.trim()}>
                  <ShieldCheck size={16} /> {connecting ? copy.working : copy.verifyCode}
                </button>
                <button className="button secondary" type="button" onClick={resetConnect}>
                  <RotateCcw size={16} /> {copy.reset}
                </button>
              </div>
            </form>
          ) : null}

          {connectStep === "password" && connectAuth ? (
            <form className="form-grid" onSubmit={verifyConnect}>
              <label className="field full">
                <span>{copy.passwordTitle}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={connectForm.password}
                  onChange={(event) => setConnectForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={connecting || !connectForm.password.trim()}>
                  <KeyRound size={16} /> {connecting ? copy.working : copy.finish}
                </button>
                <button className="button secondary" type="button" onClick={resetConnect}>
                  <RotateCcw size={16} /> {copy.reset}
                </button>
              </div>
            </form>
          ) : null}

          {connectMessage ? <p className="notice success">{connectMessage}</p> : null}
          {connectError ? <p className="notice">{connectError}</p> : null}
        </section>

        <section className="card">
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
        </section>
      </aside>
    </div>
  );
}
