import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { isDemoAdminLocked, isOwner } from "@/lib/admin-auth";
import { defaultRuntimeSettings, getRuntimeAdminSettings } from "@/lib/admin-settings";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceReadiness } from "@/lib/readiness";
import { ensureWorkspace } from "@/lib/workspace";

export default async function AdminPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isOwner(user)) {
    redirect("/dashboard");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const locked = isDemoAdminLocked(host, user);
  const workspace = await ensureWorkspace(user.id);
  const [settings, readiness, integrations] = locked
    ? [defaultRuntimeSettings(), null, []]
    : await Promise.all([
        getRuntimeAdminSettings(workspace.id),
        getWorkspaceReadiness(workspace.id),
        prisma.integrationCredential.findMany({
          where: { workspaceId: workspace.id },
          orderBy: [{ service: "asc" }, { createdAt: "desc" }],
        }),
      ]);

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Admin</h1>
          <p>{t(locale, "page.admin.subtitle")}</p>
        </div>
      </div>

      <AdminConsole
        adminLocked={locked}
        adminTokenConfigured={Boolean(process.env.RAZBY_ADMIN_TOKEN)}
        initialSettings={settings}
        initialReadiness={readiness}
        initialIntegrations={integrations.map((integration) => ({
          id: integration.id,
          service: integration.service,
          label: integration.label,
          status: integration.status,
          lastCheckedAt: integration.lastCheckedAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
