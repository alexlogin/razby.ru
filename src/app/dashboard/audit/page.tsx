import { getCurrentUser } from "@/lib/auth";
import { localeDateTags, t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export default async function AuditPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const logs = await prisma.auditLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Audit</h1>
          <p>{t(locale, "page.audit.subtitle")}</p>
        </div>
      </div>
      <section className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.createdAt.toLocaleString(localeDateTags[locale])}</td>
                <td>
                  <span className="status">{log.action}</span>
                </td>
                <td>{log.entity}</td>
                <td className="muted">{log.metadataJson}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  {t(locale, "page.audit.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
