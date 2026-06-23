import { ScenarioBuilder } from "@/components/scenario-builder";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export default async function WorkflowPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const recentScenarios = await prisma.campaign.findMany({
    where: {
      workspaceId: workspace.id,
      moduleSlug: "neurochatting",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Workflow</h1>
          <p>{t(locale, "page.workflow.subtitle")}</p>
        </div>
      </div>

      <ScenarioBuilder
        initialScenarios={recentScenarios.map((scenario) => ({
          id: scenario.id,
          name: scenario.name,
          status: scenario.status,
          createdAt: scenario.createdAt.toISOString(),
          settings: JSON.parse(scenario.settingsJson),
        }))}
      />
    </>
  );
}
