import { prisma } from "@/lib/prisma";
import { getModulePolicy } from "@/lib/module-adapters";
import { getWorkspaceExecutionMode } from "@/lib/admin-settings";
import { authEmailAllowlist, hasEmailDeliveryConfig, isEmailAuthEnabled } from "@/lib/email-auth";

export type ReadinessState = "ready" | "warn" | "blocked";

export type ReadinessCheck = {
  key: string;
  label: string;
  state: ReadinessState;
  help: string;
};

const serviceLabels: Record<string, string> = {
  "telegram-api": "Telegram API",
  "telegram-bot": "Telegram Bot",
  "telegram-session": "Telegram Session",
  openrouter: "OpenRouter",
  "google-oauth": "Google OAuth",
  "ai-provider": "AI Provider",
  worker: "Worker",
  accounts: "Telegram accounts",
  proxies: "Proxy endpoints",
};

function hasProductionSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return secret.length >= 32 && !secret.includes("dev-") && !secret.includes("replace-with");
}

function isRecent(date: Date | null | undefined, maxAgeMs: number) {
  if (!date) {
    return false;
  }

  return Date.now() - date.getTime() <= maxAgeMs;
}

export async function getWorkspaceReadiness(workspaceId: string) {
  const [integrations, accountsCount, proxiesCount, latestHeartbeat] = await Promise.all([
    prisma.integrationCredential.findMany({
      where: { workspaceId },
      select: { service: true, status: true },
    }),
    prisma.telegramAccount.count({ where: { workspaceId } }),
    prisma.proxyEndpoint.count({ where: { workspaceId } }),
    prisma.workerHeartbeat.findFirst({
      where: { workspaceId },
      orderBy: { seenAt: "desc" },
      select: { seenAt: true, status: true },
    }),
  ]);

  const services = new Set(integrations.filter((item) => item.status === "READY" || item.status === "SAVED").map((item) => item.service));
  const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasOwnerAccess = Boolean(process.env.RAZBY_OWNER_ACCESS_CODE || process.env.RAZBY_ADMIN_TOKEN);
  const emailAuthEnabled = isEmailAuthEnabled();
  const hasEmailAuth = emailAuthEnabled && authEmailAllowlist().length > 0 && hasEmailDeliveryConfig();
  const hasGoogleSaved = services.has("google-oauth");
  const hasAiProvider = services.has("ai-provider") || services.has("openrouter");
  const demoMode = process.env.RAZBY_DEMO_MODE === "true";
  const mode = await getWorkspaceExecutionMode(workspaceId);

  const checks: ReadinessCheck[] = [
    {
      key: "nextauth-secret",
      label: "NextAuth secret",
      state: hasProductionSecret() ? "ready" : "blocked",
      help: "На VPS нужен длинный уникальный NEXTAUTH_SECRET.",
    },
    {
      key: "google-oauth",
      label: "Google OAuth",
      state: hasGoogle ? "ready" : hasGoogleSaved || hasEmailAuth || hasOwnerAccess || demoMode ? "warn" : "blocked",
      help: hasGoogle
        ? "Production-вход через Google активен."
        : hasGoogleSaved
          ? "Ключи сохранены в админке, но NextAuth требует GOOGLE_CLIENT_ID/SECRET в .env и рестарт."
          : hasEmailAuth
            ? "Сейчас основной вход работает через email-код; Google подключим после домена."
          : hasOwnerAccess
            ? "Пока домена нет, вход на VPS работает через код владельца; Google подключим после домена."
            : "Production-вход работает через GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.",
    },
    {
      key: "email-auth",
      label: "Email code login",
      state: hasEmailAuth ? "ready" : emailAuthEnabled ? "warn" : "warn",
      help: hasEmailAuth
        ? "Email-вход включён: allowlist и Resend настроены."
        : emailAuthEnabled
          ? "Для email-входа нужны RAZBY_AUTH_EMAILS, RAZBY_RESEND_API_KEY и RAZBY_EMAIL_FROM."
          : "Email-вход можно включить через RAZBY_EMAIL_AUTH_ENABLED=true.",
    },
    {
      key: "owner-access",
      label: "Owner IP access",
      state: hasOwnerAccess ? "ready" : "blocked",
      help: "Для входа по IP нужен RAZBY_OWNER_ACCESS_CODE или временно RAZBY_ADMIN_TOKEN.",
    },
    {
      key: "demo-mode",
      label: "Demo mode",
      state: demoMode ? "warn" : "ready",
      help: hasOwnerAccess
        ? "На VPS можно держать RAZBY_DEMO_MODE=false и входить по коду владельца."
        : "Для VPS выставить RAZBY_DEMO_MODE=false после настройки production-входа.",
    },
    {
      key: "database",
      label: "Database",
      state: process.env.DATABASE_URL ? "ready" : "blocked",
      help: "DATABASE_URL должен указывать на SQLite-файл или будущую production-базу.",
    },
    {
      key: "telegram-api",
      label: "Telegram API",
      state: services.has("telegram-api") ? "ready" : "warn",
      help: "Нужны API ID и API Hash для live-модулей Telegram.",
    },
    {
      key: "telegram-session",
      label: "Telegram sessions",
      state: services.has("telegram-session") ? "ready" : "warn",
      help: "Для live-запусков нужны session strings подключённых аккаунтов.",
    },
    {
      key: "ai-provider",
      label: "AI provider",
      state: hasAiProvider ? "ready" : "warn",
      help: "Нужен AI/OpenRouter API key для НейроДиалогов, нейрочаттинга и нейрокомментинга.",
    },
    {
      key: "accounts",
      label: "Telegram accounts",
      state: accountsCount > 0 ? "ready" : "blocked",
      help: "Добавьте хотя бы один Telegram-аккаунт.",
    },
    {
      key: "proxies",
      label: "Proxy endpoints",
      state: proxiesCount > 0 ? "ready" : "warn",
      help: "Для охватных и прогревочных модулей нужны прокси.",
    },
    {
      key: "worker",
      label: "Worker heartbeat",
      state: isRecent(latestHeartbeat?.seenAt, 120_000) ? "ready" : "warn",
      help: "Production worker запускается командой npm run worker -- --watch.",
    },
    {
      key: "execution-mode",
      label: "Execution mode",
      state: mode === "live" ? "ready" : "warn",
      help: mode === "live" ? "Боевой режим включён в админке." : "Сейчас режим simulate. Боевой режим включается в Admin.",
    },
  ];

  return {
    executionMode: mode,
    checks,
    readyForProduction: checks.every((check) => check.state !== "blocked"),
  };
}

export async function getModuleReadiness(workspaceId: string, slug: string) {
  const policy = getModulePolicy(slug);
  const workspaceReadiness = await getWorkspaceReadiness(workspaceId);
  const mode = workspaceReadiness.executionMode;
  const workspaceChecks = new Map(workspaceReadiness.checks.map((check) => [check.key, check]));
  const required = new Set(policy.requires);

  if (policy.requires.includes("telegram-api")) {
    required.add("telegram-session");
  }

  if (mode === "live") {
    required.add("worker");
  }

  const checks = Array.from(required).map((key) => {
    const check = workspaceChecks.get(key);

    return (
      check ?? {
        key,
        label: serviceLabels[key] ?? key,
        state: "warn" as ReadinessState,
        help: "Требование модуля пока не подключено в readiness-check.",
      }
    );
  });

  const missingRequirements = checks.filter((check) => check.state !== "ready");

  return {
    executionMode: mode,
    policy,
    checks,
    missingRequirements,
    readyForLive: missingRequirements.length === 0,
  };
}
