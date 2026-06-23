import { AccountManager } from "@/components/account-manager";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { ensureWorkspace } from "@/lib/workspace";

export default async function AccountsPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Accounts</h1>
          <p>{t(locale, "page.accounts.subtitle")}</p>
        </div>
      </div>
      <AccountManager initialAccounts={workspace.telegramAccounts} />
    </>
  );
}
