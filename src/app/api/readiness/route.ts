import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceReadiness } from "@/lib/readiness";
import { ensureWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await ensureWorkspace(user.id);
  const readiness = await getWorkspaceReadiness(workspace.id);

  return NextResponse.json(readiness);
}
