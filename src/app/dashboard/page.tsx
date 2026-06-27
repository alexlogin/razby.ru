import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getLocalizedModules, localeDateTags, t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export default async function DashboardPage() {
  const locale = await getRequestLocale();
  const modules = getLocalizedModules(locale);
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const [runs, leadsCount, campaignsCount, approvalsCount, inboxOpenCount] = await Promise.all([
    prisma.moduleRun.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.lead.count({ where: { workspaceId: workspace.id } }),
    prisma.campaign.count({ where: { workspaceId: workspace.id } }),
    prisma.approvalItem.count({ where: { workspaceId: workspace.id, status: "PENDING" } }),
    prisma.telegramConversation.count({ where: { workspaceId: workspace.id, status: "OPEN" } }),
  ]);

  const activeAccounts = workspace.telegramAccounts.filter((account) => account.status === "ACTIVE").length;
  const riskAccounts = workspace.telegramAccounts.filter((account) => account.status === "RISK" || account.status === "BLOCKED").length;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p>{t(locale, "dashboard.subtitle")}</p>
        </div>
        <Link className="button" href="/dashboard/workflow">
          {t(locale, "dashboard.workflowButton")} <ArrowRight size={16} />
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span>Accounts</span>
          <strong>{workspace.telegramAccounts.length}</strong>
        </div>
        <div className="stat">
          <span>Active</span>
          <strong>{activeAccounts}</strong>
        </div>
        <div className="stat">
          <span>Risk</span>
          <strong>{riskAccounts}</strong>
        </div>
        <div className="stat">
          <span>Leads</span>
          <strong>{leadsCount}</strong>
        </div>
        <div className="stat">
          <span>Approvals</span>
          <strong>{approvalsCount}</strong>
        </div>
        <div className="stat">
          <span>Inbox open</span>
          <strong>{inboxOpenCount}</strong>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h2>{t(locale, "dashboard.moduleCockpit")}</h2>
          <div className="module-grid">
            {modules.slice(0, 6).map((module) => {
              const Icon = module.icon;
              return (
                <Link className="module-card" href={`/dashboard/modules/${module.slug}`} key={module.slug}>
                  <div className="module-card-head">
                    <span className="feature-icon">
                      <Icon size={18} />
                    </span>
                    <span className="status">{module.categoryLabel}</span>
                  </div>
                  <div>
                    <h3>{module.title}</h3>
                    <p className="muted">{module.outcome}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="card">
          <h2>{t(locale, "dashboard.workspaceHealth")}</h2>
          <table className="data-table">
            <tbody>
              <tr>
                <td>{t(locale, "dashboard.plan")}</td>
                <td>
                  <span className="status">{workspace.plan}</span>
                </td>
              </tr>
              <tr>
                <td>{t(locale, "dashboard.campaigns")}</td>
                <td>{campaignsCount}</td>
              </tr>
              <tr>
                <td>{t(locale, "dashboard.proxyEndpoints")}</td>
                <td>{workspace.proxies.length}</td>
              </tr>
              <tr>
                <td>{t(locale, "dashboard.referralCode")}</td>
                <td>{workspace.referralCodes[0]?.code ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t(locale, "dashboard.latestRuns")}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t(locale, "dashboard.module")}</th>
              <th>{t(locale, "dashboard.status")}</th>
              <th>{t(locale, "dashboard.created")}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.title}</td>
                <td>
                  <span className="status">{run.status}</span>
                </td>
                <td>{run.createdAt.toLocaleString(localeDateTags[locale])}</td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  {t(locale, "dashboard.noRuns")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
