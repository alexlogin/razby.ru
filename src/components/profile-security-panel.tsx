"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type ProfileSecurityPanelProps = {
  email: string | null;
  hasPassword: boolean;
  passwordUpdatedAt: string | null;
};

export function ProfileSecurityPanel({ email, hasPassword: initialHasPassword, passwordUpdatedAt }: ProfileSecurityPanelProps) {
  const { dateLocale, t } = useI18n();
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError(t("profile.errMismatch"));
      return;
    }

    setSaving(true);
    const response = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password }),
    });
    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : t("profile.errSave"));
      return;
    }

    setHasPassword(Boolean(data.hasPassword));
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setMessage(hasPassword ? t("profile.updatedMessage") : t("profile.savedMessage"));
  }

  return (
    <section className="card profile-security">
      <div className="card-title-row">
        <h2>
          <ShieldCheck size={19} /> {t("profile.title")}
        </h2>
        <span className={`status ${hasPassword ? "" : "warn"}`}>{hasPassword ? "password ready" : "code only"}</span>
      </div>
      <div className="profile-summary">
        <div>
          <span className="muted small">{t("profile.email")}</span>
          <strong>{email ?? t("profile.emailMissing")}</strong>
        </div>
        <div>
          <span className="muted small">{t("profile.password")}</span>
          <strong>{hasPassword ? t("profile.passwordSaved") : t("profile.passwordMissing")}</strong>
        </div>
        <div>
          <span className="muted small">{t("profile.updated")}</span>
          <strong>{passwordUpdatedAt ? new Date(passwordUpdatedAt).toLocaleString(dateLocale) : t("profile.notYet")}</strong>
        </div>
      </div>
      <form className="form-grid" onSubmit={savePassword}>
        {hasPassword ? (
          <label className="field full">
            <span>{t("profile.currentPassword")}</span>
            <input
              className="input"
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={t("profile.currentPasswordPlaceholder")}
              type="password"
              value={currentPassword}
            />
          </label>
        ) : null}
        <label className="field">
          <span>{t("profile.newPassword")}</span>
          <input
            className="input"
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("profile.newPasswordPlaceholder")}
            type="password"
            value={password}
          />
        </label>
        <label className="field">
          <span>{t("profile.repeatPassword")}</span>
          <input
            className="input"
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={t("profile.repeatPasswordPlaceholder")}
            type="password"
            value={confirmPassword}
          />
        </label>
        <div className="form-actions">
          <button className="button" disabled={saving || !password || !confirmPassword || (hasPassword && !currentPassword)} type="submit">
            {saving ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
            {hasPassword ? t("profile.changePassword") : t("profile.savePassword")}
          </button>
          {hasPassword ? (
            <span className="inline-ok">
              <CheckCircle2 size={16} /> {t("profile.emailCodeBackup")}
            </span>
          ) : null}
        </div>
      </form>
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice">{error}</div> : null}
    </section>
  );
}
