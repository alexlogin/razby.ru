"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, Hash, KeyRound, LockKeyhole, Loader2, Mail } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type AuthActionsProps = {
  googleReady: boolean;
  demoMode: boolean;
  ownerAccessReady: boolean;
  emailAuthEnabled: boolean;
};

export function AuthActions({ googleReady, demoMode, ownerAccessReady, emailAuthEnabled }: AuthActionsProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCodeRequested, setEmailCodeRequested] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);

  async function requestEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsRequestingCode(true);

    const response = await fetch("/api/auth/email-code/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setIsRequestingCode(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : t("login.errEmailCode"));
      return;
    }

    setEmailCodeRequested(true);
    setMessage(data.devCode ? t("login.msgDevCode", { code: data.devCode }) : t("login.msgCodeSent"));
  }

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const result = await signIn("email-password", {
      email: passwordEmail,
      password,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError(t("login.errPassword"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    const result = await signIn("email-code", {
      email,
      code: emailCode,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError(t("login.errCode"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleOwnerSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("owner-code", {
      accessCode,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError(t("login.errOwner"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
      <form className="owner-login-form password-login-panel" onSubmit={handlePasswordSignIn}>
        <div className="login-method-title">
          <KeyRound size={16} />
          <strong>{t("login.fast")}</strong>
        </div>
        <label className="field">
          <span>{t("login.email")}</span>
          <input
            className="input"
            autoComplete="email"
            name="passwordEmail"
            onChange={(event) => setPasswordEmail(event.target.value)}
            placeholder="owner@example.com"
            type="email"
            value={passwordEmail}
          />
        </label>
        <label className="field">
          <span>{t("login.password")}</span>
          <input
            className="input"
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("login.passwordPlaceholder")}
            type="password"
            value={password}
          />
        </label>
        <button className="button" disabled={isSubmitting || !passwordEmail.trim() || !password} type="submit">
          {isSubmitting ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
          {t("login.passwordButton")}
        </button>
      </form>

      {emailAuthEnabled ? (
        <div className="email-login-panel">
          <div className="login-method-title">
            <Mail size={16} />
            <strong>{t("login.recovery")}</strong>
          </div>
          <form className="owner-login-form" onSubmit={requestEmailCode}>
            <label className="field">
              <span>{t("login.email")}</span>
              <input
                className="input"
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@example.com"
                type="email"
                value={email}
              />
            </label>
            <button className="button" disabled={isRequestingCode || !email.trim()} type="submit">
              {isRequestingCode ? <Loader2 className="spin" size={16} /> : <Mail size={16} />}
              {t("login.getCode")}
            </button>
          </form>

          {emailCodeRequested ? (
            <form className="owner-login-form" onSubmit={handleEmailSignIn}>
              <label className="field">
                <span>{t("login.code")}</span>
                <input
                  className="input"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  name="emailCode"
                  onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  type="text"
                  value={emailCode}
                />
              </label>
              <button className="button" disabled={isSubmitting || emailCode.length !== 6} type="submit">
                {isSubmitting ? <Loader2 className="spin" size={16} /> : <Hash size={16} />}
                {t("login.codeButton")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {ownerAccessReady ? (
        <form className="owner-login-form" onSubmit={handleOwnerSignIn}>
          <label className="field">
            <span>{t("login.ownerCode")}</span>
            <input
              className="input"
              autoComplete="current-password"
              name="accessCode"
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder={t("login.ownerPlaceholder")}
              type="password"
              value={accessCode}
            />
          </label>
          <button className="button" disabled={isSubmitting || !accessCode.trim()} type="submit">
            {isSubmitting ? <Loader2 className="spin" size={16} /> : <LockKeyhole size={16} />}
            {t("login.ipButton")}
          </button>
        </form>
      ) : null}

      {googleReady ? (
        <button className="button secondary" type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
          <KeyRound size={16} /> {t("login.google")}
        </button>
      ) : null}

      {demoMode ? (
        <Link className="button secondary" href="/dashboard">
          {t("login.localWorkspace")} <ArrowRight size={16} />
        </Link>
      ) : null}
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice">{error}</div> : null}
      {!googleReady && !ownerAccessReady && !emailAuthEnabled ? (
        <div className="notice">
          {t("login.notConfigured")}
        </div>
      ) : null}
    </div>
  );
}
