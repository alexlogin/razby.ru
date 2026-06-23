import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createModuleRun } from "@/lib/module-engine";
import { modules } from "@/lib/modules";
import { ensureWorkspace } from "@/lib/workspace";

const runSchema = z.object({
  slug: z.string().min(2),
  input: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  const { searchParams } = new URL(request.url);
  const moduleSlug = searchParams.get("module");

  const runs = await prisma.moduleRun.findMany({
    where: {
      workspaceId: workspace.id,
      ...(moduleSlug ? { moduleSlug } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    runs: runs.map((run) => ({
      ...run,
      input: JSON.parse(run.inputJson),
      result: run.resultJson ? JSON.parse(run.resultJson) : null,
      logs: run.logsJson ? JSON.parse(run.logsJson) : [],
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = runSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const allowedSlugs = new Set([...modules.map((module) => module.slug), "proxy-checker"]);

  if (!allowedSlugs.has(parsed.data.slug)) {
    return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  }

  const workspace = await ensureWorkspace(user.id);
  const run = await createModuleRun(workspace.id, parsed.data.slug, parsed.data.input, user.id);

  return NextResponse.json({
    run: {
      ...run,
      input: JSON.parse(run.inputJson),
      result: run.resultJson ? JSON.parse(run.resultJson) : null,
      logs: run.logsJson ? JSON.parse(run.logsJson) : [],
    },
  });
}
