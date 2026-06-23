"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { BarChart3, CheckSquare, ClipboardList, Database, Gift, Inbox, LayoutDashboard, ListChecks, LogOut, Route, Search, Settings, ShieldCheck, Wrench } from "lucide-react";
import { getLocalizedModules, getLocalizedNavigationGroups } from "@/lib/i18n";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ModuleAssistant } from "@/components/module-assistant";
import { RazbyLogo } from "@/components/razby-logo";

type DashboardShellProps = {
  user: {
    name?: string | null;
    email?: string | null;
  };
  children: React.ReactNode;
};

const utilityLinks = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/dashboard/workflow", labelKey: "nav.workflow", icon: Route },
  { href: "/dashboard/inbox", labelKey: "nav.inbox", icon: Inbox },
  { href: "/dashboard/approvals", labelKey: "nav.approvals", icon: CheckSquare },
  { href: "/dashboard/admin", labelKey: "nav.admin", icon: ShieldCheck },
  { href: "/dashboard/accounts", labelKey: "nav.accounts", icon: Database },
  { href: "/dashboard/campaigns", labelKey: "nav.campaigns", icon: ClipboardList },
  { href: "/dashboard/leads", labelKey: "nav.leads", icon: BarChart3 },
  { href: "/dashboard/tools", labelKey: "nav.tools", icon: Wrench },
  { href: "/dashboard/referrals", labelKey: "nav.referrals", icon: Gift },
  { href: "/dashboard/audit", labelKey: "nav.audit", icon: ListChecks },
  { href: "/dashboard/settings", labelKey: "nav.settings", icon: Settings },
];

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const modules = getLocalizedModules(locale);
  const navigationGroups = getLocalizedNavigationGroups(locale);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link href="/dashboard">
            <RazbyLogo />
          </Link>
        </div>

        <div className="nav-group">{t("nav.workspace")}</div>
        {utilityLinks.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link className={`side-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
              <Icon size={16} /> {t(item.labelKey)}
            </Link>
          );
        })}

        {navigationGroups.map((group) => (
          <div className="nav-section" key={group.title}>
            <div className="nav-group">{group.title}</div>
            {group.slugs.map((slug) => {
              const module = modules.find((item) => item.slug === slug);

              if (!module) {
                return null;
              }

              const Icon = module.icon;
              const href = `/dashboard/modules/${module.slug}`;
              const active = pathname === href;

              return (
                <Link className={`side-link ${active ? "active" : ""}`} href={href} key={module.slug}>
                  <Icon size={16} /> {module.title}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
      <main className="app-main">
        <header className="app-header">
          <div className="command">
            <Search size={16} />
            {t("common.search")}
          </div>
          <div className="user-menu">
            <LanguageSwitcher compact />
            <div style={{ textAlign: "right" }}>
              <strong>{user.name ?? t("common.userFallback")}</strong>
              <div className="muted small">{user.email ?? t("common.demoWorkspace")}</div>
            </div>
            <button className="icon-button" type="button" aria-label={t("common.signOut")} title={t("common.signOut")} onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <div className="app-content">{children}</div>
        <ModuleAssistant />
      </main>
    </div>
  );
}
