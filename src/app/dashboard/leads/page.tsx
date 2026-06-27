import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export default async function LeadsPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Leads</h1>
          <p>{t(locale, "page.leads.subtitle")}</p>
        </div>
        <a className="button" href="/api/leads/export">
          Export CSV
        </a>
      </div>
      <section className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Source</th>
              <th>Score</th>
              <th>Tags</th>
              <th>Bio</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <strong>{lead.username}</strong>
                  <div className="muted small">{lead.displayName}</div>
                </td>
                <td>{lead.source}</td>
                <td>{lead.score}</td>
                <td>{JSON.parse(lead.tags).join(", ")}</td>
                <td className="muted">{lead.bio}</td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t(locale, "page.leads.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
