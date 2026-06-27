import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuthActions } from "@/components/auth-actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RazbyLogo } from "@/components/razby-logo";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const locale = await getRequestLocale();
  const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const ownerAccessReady = Boolean(process.env.RAZBY_OWNER_ACCESS_CODE || process.env.RAZBY_ADMIN_TOKEN);
  const emailAuthEnabled = process.env.RAZBY_EMAIL_AUTH_ENABLED === "true";
  const demoMode = process.env.RAZBY_DEMO_MODE === "true";

  return (
    <main className="login-page">
      <section className="login-brand">
        <div style={{ maxWidth: 520 }}>
          <RazbyLogo />
          <h1 style={{ fontSize: 58, lineHeight: 1, margin: "42px 0 18px" }}>{t(locale, "login.hero.title")}</h1>
          <p style={{ color: "#cbd5e1", lineHeight: 1.8, fontSize: 18 }}>{t(locale, "login.hero.text")}</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-box">
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <Link className="button ghost" href="/">
              <ArrowLeft size={16} /> {t(locale, "login.back")}
            </Link>
            <LanguageSwitcher compact />
          </div>
          <h1>{t(locale, "login.title")}</h1>
          <p>{t(locale, "login.text")}</p>
          <AuthActions googleReady={googleReady} demoMode={demoMode} ownerAccessReady={ownerAccessReady} emailAuthEnabled={emailAuthEnabled} />
          <div className="card" style={{ marginTop: 28 }}>
            <h3>
              <ShieldCheck size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
              {t(locale, "login.secureTitle")}
            </h3>
            <p className="muted">{t(locale, "login.secureText")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
