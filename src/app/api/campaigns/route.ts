import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { modules } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { ensureWorkspace } from "@/lib/workspace";

const campaignSchema = z.object({
  name: z.string().min(2),
  moduleSlug: z.string().min(2),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      settings: JSON.parse(campaign.settingsJson),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = campaignSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!modules.some((module) => module.slug === parsed.data.moduleSlug)) {
    return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  }

  const workspace = await ensureWorkspace(user.id);
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      moduleSlug: parsed.data.moduleSlug,
      name: parsed.data.name,
      settingsJson: JSON.stringify(parsed.data.settings),
    },
  });

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "campaign.created",
    entity: "Campaign",
    entityId: campaign.id,
    metadata: { moduleSlug: campaign.moduleSlug },
  });

  return NextResponse.json({
    campaign: {
      ...campaign,
      settings: JSON.parse(campaign.settingsJson),
    },
  });
}
