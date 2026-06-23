import { prisma } from "@/lib/prisma";

export async function ensureWorkspace(userId: string) {
  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    include: {
      telegramAccounts: true,
      proxies: true,
      referralCodes: true,
    },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Razby Workspace",
        ownerId: userId,
      },
      include: {
        telegramAccounts: true,
        proxies: true,
        referralCodes: true,
      },
    });
  }

  if (workspace.telegramAccounts.length === 0) {
    await prisma.telegramAccount.createMany({
      data: [
        {
          workspaceId: workspace.id,
          label: "Core parser 01",
          username: "@sg_parser_01",
          phone: "+10000000001",
          status: "ACTIVE",
          healthScore: 94,
          ggrScore: 8.7,
          proxy: "EU pool",
          notes: "Основной аккаунт для ресерча каналов.",
        },
        {
          workspaceId: workspace.id,
          label: "Warm reserve 12",
          username: "@sg_warm_12",
          phone: "+10000000012",
          status: "WARMING",
          healthScore: 78,
          ggrScore: 6.9,
          proxy: "Mobile mix",
          notes: "Идёт прогрев, низкий дневной темп.",
        },
        {
          workspaceId: workspace.id,
          label: "Dialog agent 04",
          username: "@sg_dialog_04",
          phone: "+10000000004",
          status: "RISK",
          healthScore: 61,
          ggrScore: 5.2,
          proxy: "US slow",
          notes: "Ограничить активность до повторной проверки.",
        },
      ],
    });
  }

  if (workspace.proxies.length === 0) {
    await prisma.proxyEndpoint.createMany({
      data: [
        {
          workspaceId: workspace.id,
          label: "EU pool",
          protocol: "SOCKS5",
          host: "185.21.42.10",
          port: 1080,
          status: "ONLINE",
          latencyMs: 118,
          country: "DE",
        },
        {
          workspaceId: workspace.id,
          label: "Mobile mix",
          protocol: "HTTP",
          host: "91.204.17.44",
          port: 8080,
          status: "SLOW",
          latencyMs: 420,
          country: "PL",
        },
      ],
    });
  }

  if (workspace.referralCodes.length === 0) {
    const defaultCode = `SUPER-${workspace.id.slice(0, 6).toUpperCase()}`;
    await prisma.referralCode.upsert({
      where: { code: defaultCode },
      update: {},
      create: {
        workspaceId: workspace.id,
        ownerId: userId,
        code: defaultCode,
        commission: 20,
        clicks: 184,
        signups: 16,
      },
    });
  }

  return prisma.workspace.findFirstOrThrow({
    where: { ownerId: userId },
    include: {
      telegramAccounts: {
        orderBy: { createdAt: "asc" },
      },
      proxies: {
        orderBy: { createdAt: "asc" },
      },
      referralCodes: true,
    },
  });
}
