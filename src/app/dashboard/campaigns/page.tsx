import { CampaignManager } from "@/components/campaign-manager";
import { getCurrentUser } from "@/lib/auth";
import { getLocalizedModules, t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export default async function CampaignsPage() {
  const locale = await getRequestLocale();
  const modules = getLocalizedModules(locale);
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Campaigns</h1>
          <p>{t(locale, "page.campaigns.subtitle")}</p>
        </div>
      </div>
      <CampaignManager
        modules={modules.map((module) => ({ slug: module.slug, title: module.title }))}
        initialCampaigns={campaigns.map((campaign) => ({
          ...campaign,
          settings: JSON.parse(campaign.settingsJson),
          createdAt: campaign.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
