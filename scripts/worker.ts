import { prisma } from "../src/lib/prisma";
import { processApprovedRun, processQueuedRun } from "../src/lib/module-engine";

async function once() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true },
  });

  for (const workspace of workspaces) {
    await prisma.workerHeartbeat.upsert({
      where: {
        workspaceId_workerId: {
          workspaceId: workspace.id,
          workerId: process.env.RAZBY_WORKER_ID ?? "local-worker",
        },
      },
      update: {
        status: "ONLINE",
        seenAt: new Date(),
        metadataJson: JSON.stringify({ mode: "watch", pid: process.pid }),
      },
      create: {
        workspaceId: workspace.id,
        workerId: process.env.RAZBY_WORKER_ID ?? "local-worker",
        status: "ONLINE",
        metadataJson: JSON.stringify({ mode: "watch", pid: process.pid }),
      },
    });
  }

  const queuedRuns = await prisma.moduleRun.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const run of queuedRuns) {
    await processQueuedRun(run.id, "worker");
    console.log(`Processed ${run.moduleSlug}: ${run.id}`);
  }

  const approvedRuns = await prisma.moduleRun.findMany({
    where: { status: "APPROVED_FOR_WORKER" },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  for (const run of approvedRuns) {
    await processApprovedRun(run.id, "worker");
    console.log(`Dispatched approved ${run.moduleSlug}: ${run.id}`);
  }

  return queuedRuns.length + approvedRuns.length;
}

async function main() {
  const watch = process.argv.includes("--watch");

  do {
    const count = await once();

    if (!watch) {
      break;
    }

    if (count === 0) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } while (watch);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
