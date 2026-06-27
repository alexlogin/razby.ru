import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { ensureWorkspace } from "@/lib/workspace";

export default async function ReferralsPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const referral = workspace.referralCodes[0];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Referrals</h1>
          <p>{t(locale, "page.referrals.subtitle")}</p>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <span>Code</span>
          <strong>{referral?.code ?? "—"}</strong>
        </div>
        <div className="stat">
          <span>Commission</span>
          <strong>{referral?.commission ?? 0}%</strong>
        </div>
        <div className="stat">
          <span>Clicks</span>
          <strong>{referral?.clicks ?? 0}</strong>
        </div>
        <div className="stat">
          <span>Signups</span>
          <strong>{referral?.signups ?? 0}</strong>
        </div>
      </div>
      <section className="card">
        <h2>{t(locale, "page.referrals.link")}</h2>
        <p className="muted">https://razby.ru/?ref={referral?.code ?? "SUPER"}</p>
      </section>
    </>
  );
}
