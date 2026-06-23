import { IntegrationManager } from "@/components/integration-manager";
import { ProfileSecurityPanel } from "@/components/profile-security-panel";
import { getCurrentUser } from "@/lib/auth";
import { localeDateTags, t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceReadiness } from "@/lib/readiness";
import { ensureWorkspace } from "@/lib/workspace";

export default async function SettingsPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const [integrations, heartbeats, readiness] = await Promise.all([
    prisma.integrationCredential.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ service: "asc" }, { createdAt: "desc" }],
    }),
    prisma.workerHeartbeat.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { seenAt: "desc" },
      take: 5,
    }),
    getWorkspaceReadiness(workspace.id),
  ]);

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Settings</h1>
          <p>{t(locale, "page.settings.subtitle")}</p>
        </div>
      </div>
      <ProfileSecurityPanel
        email={user!.email}
        hasPassword={Boolean(user!.passwordHash)}
        passwordUpdatedAt={user!.passwordUpdatedAt?.toISOString() ?? null}
      />
      <div className="dashboard-grid">
        <section className="card">
          <h2>Production readiness</h2>
          <p className="muted small">{t(locale, "settings.executionMode")}: {readiness.executionMode}</p>
          <table className="data-table">
            <tbody>
              {readiness.checks.map((check) => (
                <tr key={check.label}>
                  <td>
                    <strong>{check.label}</strong>
                    <div className="muted small">{check.help}</div>
                  </td>
                  <td>
                    <span className={`status ${check.state === "blocked" ? "risk" : check.state === "warn" ? "warn" : ""}`}>
                      {check.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="card">
          <h2>VPS commands</h2>
          <p className="muted">{t(locale, "settings.afterUpload")}</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
{`npm install
npm run db:init
npm run build
npm run start
npm run worker -- --watch

# ${t(locale, "settings.healthCheck")}
curl http://127.0.0.1:3000/api/health`}
          </pre>
        </aside>
      </div>
      <div style={{ marginTop: 16 }}>
        <IntegrationManager
          initialIntegrations={integrations.map((integration) => ({
            id: integration.id,
            service: integration.service,
            label: integration.label,
            status: integration.status,
            lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
          }))}
        />
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Worker heartbeat</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Status</th>
              <th>Seen</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {heartbeats.map((heartbeat) => (
              <tr key={heartbeat.id}>
                <td>{heartbeat.workerId}</td>
                <td>
                  <span className="status">{heartbeat.status}</span>
                </td>
                <td>{heartbeat.seenAt.toLocaleString(localeDateTags[locale])}</td>
                <td className="muted">{heartbeat.metadataJson}</td>
              </tr>
            ))}
            {heartbeats.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  {t(locale, "settings.workerEmpty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
