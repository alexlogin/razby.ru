import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
  const header = ["username", "displayName", "source", "score", "tags", "bio", "createdAt"];
  const rows = leads.map((lead) =>
    [
      lead.username,
      lead.displayName,
      lead.source,
      lead.score,
      JSON.parse(lead.tags).join("|"),
      lead.bio,
      lead.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );

  return new Response([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=razby-leads.csv",
    },
  });
}
