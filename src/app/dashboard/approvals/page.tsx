import { ApprovalQueue } from "@/components/approval-queue";
import { publicApproval } from "@/lib/approvals";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

export default async function ApprovalsPage() {
  const locale = await getRequestLocale();
  const user = await getCurrentUser();
  const workspace = await ensureWorkspace(user!.id);
  const approvals = await prisma.approvalItem.findMany({
    where: { workspaceId: workspace.id },
    include: {
      moduleRun: {
        select: {
          id: true,
          moduleSlug: true,
          title: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Approvals</h1>
          <p>{t(locale, "page.approvals.subtitle")}</p>
        </div>
      </div>
      <ApprovalQueue initialApprovals={JSON.parse(JSON.stringify(approvals.map(publicApproval)))} />
    </>
  );
}
