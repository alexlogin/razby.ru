import { NextResponse } from "next/server";
import { getWorkspaceExecutionMode } from "@/lib/admin-settings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const workspace = await prisma.workspace.findFirst({
      select: { id: true },
    });
    const executionMode = workspace ? await getWorkspaceExecutionMode(workspace.id) : process.env.RAZBY_EXECUTION_MODE ?? "simulate";

    return NextResponse.json({
      status: "ok",
      database: "ok",
      executionMode,
      demoMode: process.env.RAZBY_DEMO_MODE === "true",
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        message: error instanceof Error ? error.message : "Unknown health check error",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
