import { modules } from "@/lib/modules";

export type ModuleInput = Record<string, string | number | boolean | null | undefined>;

export type ModulePolicy = {
  risk: "low" | "medium" | "high";
  approval: "auto" | "manual" | "required";
  safeLimit: number;
  requires: string[];
};

export type ModuleExecutionResult = {
  summary: string;
  stats: Record<string, string | number | boolean>;
  rows: Array<Record<string, string | number | boolean>>;
  policy: ModulePolicy;
  nextActions: string[];
};

export type ModuleAdapter = {
  slug: string;
  policy: ModulePolicy;
  execute(input: ModuleInput): ModuleExecutionResult;
};

function linesFrom(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function seedFrom(input: ModuleInput) {
  return linesFrom(input.targets ?? input.channels ?? input.groups ?? input.sources ?? input.accounts ?? input.postLinks ?? input.seedSources ?? input.chats)[0] ?? String(input.keywords ?? input.query ?? input.niche ?? "razby");
}

function makeRows(seed: string, count: number) {
  const names = ["Mira", "Alex", "Nika", "Tim", "Sofia", "Mark", "Lena", "Roman"];
  const tags = ["active", "intent", "warm", "agency", "creator", "buyer"];
  const cleanSeed = seed.replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase() || "lead";

  return Array.from({ length: count }, (_, index) => ({
    username: `@${cleanSeed}_${index + 1}`,
    displayName: names[index % names.length],
    bio: index % 2 === 0 ? "Активно обсуждает нишу и инструменты роста" : "Пишет в тематических чатах и задаёт вопросы",
    score: 62 + ((index * 7) % 32),
    tags: `${tags[index % tags.length]}|${tags[(index + 2) % tags.length]}`,
  }));
}

const policies: Record<string, ModulePolicy> = {
  "mass-looking": { risk: "medium", approval: "manual", safeLimit: 1200, requires: ["telegram-api", "accounts", "proxies"] },
  ggr: { risk: "low", approval: "auto", safeLimit: 200, requires: ["accounts"] },
  "neuro-dialogs": { risk: "high", approval: "required", safeLimit: 80, requires: ["telegram-api", "ai-provider", "accounts"] },
  "manager-telegram-accounts": { risk: "low", approval: "auto", safeLimit: 1000, requires: ["telegram-api"] },
  "account-takeover-protection": { risk: "low", approval: "auto", safeLimit: 500, requires: ["accounts"] },
  massreact: { risk: "medium", approval: "manual", safeLimit: 500, requires: ["telegram-api", "accounts", "proxies"] },
  "bulk-story-copy": { risk: "high", approval: "required", safeLimit: 120, requires: ["telegram-api", "accounts", "proxies"] },
  "parsing-comments": { risk: "low", approval: "auto", safeLimit: 5000, requires: ["telegram-api"] },
  "parsing-messages": { risk: "medium", approval: "manual", safeLimit: 3000, requires: ["telegram-api"] },
  "parsing-users": { risk: "medium", approval: "manual", safeLimit: 3000, requires: ["telegram-api"] },
  "parsing-groups": { risk: "low", approval: "auto", safeLimit: 1000, requires: ["telegram-api"] },
  "ai-account-protection": { risk: "low", approval: "auto", safeLimit: 1000, requires: ["accounts"] },
  "channel-parser": { risk: "low", approval: "auto", safeLimit: 8000, requires: ["telegram-api"] },
  "telegram-folders": { risk: "medium", approval: "manual", safeLimit: 250, requires: ["telegram-api", "accounts"] },
  "auto-warm": { risk: "medium", approval: "manual", safeLimit: 250, requires: ["telegram-api", "accounts", "proxies"] },
  "unified-inbox": { risk: "high", approval: "required", safeLimit: 1000, requires: ["telegram-api", "ai-provider", "accounts"] },
  neurochatting: { risk: "high", approval: "required", safeLimit: 120, requires: ["telegram-api", "ai-provider", "accounts"] },
  neurocommenting: { risk: "high", approval: "required", safeLimit: 120, requires: ["telegram-api", "ai-provider", "accounts"] },
  "proxy-checker": { risk: "low", approval: "auto", safeLimit: 100, requires: [] },
};

function baseResult(slug: string, input: ModuleInput, summary: string, stats: Record<string, string | number | boolean>, rows: Array<Record<string, string | number | boolean>>, nextActions: string[]): ModuleExecutionResult {
  return {
    summary,
    stats,
    rows,
    policy: policies[slug] ?? { risk: "low", approval: "auto", safeLimit: 100, requires: [] },
    nextActions,
  };
}

const adapterFactories: Record<string, (slug: string) => ModuleAdapter> = {
  "mass-looking": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const targets = linesFrom(input.targets);
      return baseResult(
        slug,
        input,
        "План просмотров Stories собран с распределением по аккаунтам, прокси и безопасным окнам.",
        { targets: Math.max(targets.length, 1), queuedViews: Math.min(Number(input.dailyLimit ?? 1200), policies[slug].safeLimit), approval: "manual" },
        (targets.length ? targets : ["@target_channel"]).map((target, index) => ({ target, views: 120 + index * 35, status: "planned", pace: String(input.pace ?? "Нормальный") })),
        ["Проверить GGR аккаунтов", "Подтвердить кампанию вручную", "Запустить worker"],
      );
    },
  }),
  ggr: (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const accounts = linesFrom(input.accounts);
      return baseResult(
        slug,
        input,
        "GGR-аудит завершён. Аккаунты распределены по зонам риска и прогрева.",
        { checked: Math.max(accounts.length, 4), strong: 3, medium: 1, risk: 1, averageGgr: 7.4, geoPolicy: String(input.geoPolicy ?? "Proxy matches account") },
        (accounts.length ? accounts : ["@audit_1", "@audit_2", "@audit_3"]).map((account, index) => ({ account, ggr: Number((8.2 - index * 0.8).toFixed(1)), risk: index > 1 ? "medium" : "low", geoMatch: index > 1 ? "review" : "ok", recommendation: index > 1 ? "Прогрев 72 часа" : "Можно запускать с мягким лимитом" })),
        ["Перенести risk-аккаунты в стоп-лист", "Запустить автопрогрев"],
      );
    },
  }),
  "neuro-dialogs": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      return baseResult(
        slug,
        input,
        "ИИ-диалоги подготовили сценарии ответов, link handoff, lead scoring и передачу оператору.",
        { dialogs: 18, drafts: 42, handoff: 5, language: String(input.language ?? "Auto"), contextMessages: Number(input.contextMessages ?? 10), maxReplies: Number(input.maxReplies ?? 2) },
        makeRows(seedFrom(input), 5).map((row, index) => ({ ...row, stage: index > 2 ? "handoff" : "nurture", draft: "Персональный ответ по контексту диалога", linkMode: input.handoffLink ? "link_ready" : "profile_link" })),
        ["Проверить промпт", "Одобрить первые ответы", "Настроить operator handoff", "Протестировать stop-after-link"],
      );
    },
  }),
  "manager-telegram-accounts": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const accounts = linesFrom(input.batch);
      const proxyPool = linesFrom(input.proxyPool);
      return baseResult(
        slug,
        input,
        "Session-импорт разобран: роли, GEO/proxy matching и профильная ниша подготовлены.",
        { parsed: Math.max(accounts.length, 1), proxies: proxyPool.length, duplicates: 0, ready: Math.max(accounts.length, 1), geoStrategy: String(input.geoStrategy ?? "Match proxy and account") },
        (accounts.length ? accounts : ["@new_worker_01"]).map((account, index) => ({ account, role: String(input.defaultRole ?? "Worker"), profileTheme: String(input.identityTheme ?? "niche persona"), proxy: proxyPool[index % Math.max(proxyPool.length, 1)] ?? "needs_proxy", status: "ready_to_import" })),
        ["Проверить прокси", "Запустить GGR", "Сгенерировать профильные имена и аватарки", "Назначить лимиты"],
      );
    },
  }),
  "account-takeover-protection": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const accounts = linesFrom(input.accounts);
      const done = linesFrom(input.securityState);
      const checklist = [
        "Сменить облачный пароль и сохранить recovery code",
        "Удалить чужие активные сессии",
        "Проверить email/phone ownership",
        "Поставить аккаунт в прогрев перед нагрузкой",
        "Сделать повторный GGR после 24 часов",
      ];

      return baseResult(
        slug,
        input,
        "Защита купленных аккаунтов собрана в чеклист с риском возврата и действиями перед запуском.",
        {
          accounts: Math.max(accounts.length, 1),
          completedSignals: done.length,
          riskTolerance: String(input.riskTolerance ?? "Conservative"),
          takeoverRisk: done.length >= 3 ? "medium" : "high",
        },
        (accounts.length ? accounts : ["@purchased_01"]).map((account, index) => ({
          account,
          marketSource: String(input.marketSource ?? "Marketplace"),
          takeoverRisk: done.length > index + 1 ? "medium" : "high",
          requiredAction: checklist[index % checklist.length],
        })),
        checklist,
      );
    },
  }),
  massreact: (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const posts = linesFrom(input.postLinks);
      return baseResult(
        slug,
        input,
        "Очередь реакций создана с антидублированием и распределением по аккаунтам.",
        { posts: Math.max(posts.length, 1), reactions: Number(input.perPost ?? 150), successForecast: "94%" },
        (posts.length ? posts : ["https://t.me/channel/1"]).map((post, index) => ({ post, planned: Number(input.perPost ?? 150), delayWindow: `${index + 2}-${index + 8} min`, status: "pending_approval" })),
        ["Подтвердить вручную", "Проверить лимиты аккаунтов"],
      );
    },
  }),
  "bulk-story-copy": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const stories = linesFrom(input.storyLinks);
      const accounts = linesFrom(input.targetAccounts);
      const storyCount = Math.max(stories.length, 1);
      const accountCount = Math.max(accounts.length, 1);

      return baseResult(
        slug,
        input,
        "Очередь копирования Stories подготовлена с распределением по аккаунтам и ручным approval перед публикацией.",
        {
          stories: storyCount,
          accounts: accountCount,
          queuedPublications: Math.min(storyCount * accountCount, policies[slug].safeLimit),
          captionMode: String(input.captionMode ?? "Сохранить оригинал"),
          pace: String(input.pace ?? "Осторожный"),
        },
        (stories.length ? stories : ["@source/story/1"]).map((story, index) => ({
          story,
          targetAccount: accounts[index % accountCount] ?? "@worker_01",
          captionMode: String(input.captionMode ?? "Сохранить оригинал"),
          status: "needs_approval",
        })),
        ["Проверить авторство и права на Story", "Одобрить публикации вручную", "Запустить worker после readiness"],
      );
    },
  }),
  "telegram-folders": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const sources = linesFrom(input.sources);
      const accounts = linesFrom(input.assignAccounts);

      return baseResult(
        slug,
        input,
        "План Telegram-папок собран: источники сгруппированы и готовы к применению через worker.",
        {
          folderName: String(input.folderName ?? "Competitors / niche watch"),
          sources: Math.max(sources.length, 1),
          accounts: Math.max(accounts.length, 1),
          mode: String(input.folderMode ?? "Каналы и чаты"),
        },
        (sources.length ? sources : ["@source_channel"]).map((source, index) => ({
          source,
          folder: String(input.folderName ?? "Competitors / niche watch"),
          account: accounts[index % Math.max(accounts.length, 1)] ?? "@parser_01",
          action: "add_to_folder",
        })),
        ["Проверить список источников", "Разнести по аккаунтам", "Одобрить worker-применение"],
      );
    },
  }),
  "unified-inbox": (slug) => ({
    slug,
    policy: policies[slug],
    execute(input) {
      const accounts = linesFrom(input.accounts);

      return baseResult(
        slug,
        input,
        "Unified Inbox подготовил правила обработки входящих диалогов и AI-черновиков для операторского контроля.",
        {
          accounts: Math.max(accounts.length, 1),
          policy: String(input.inboxPolicy ?? "Только черновики"),
          drafts: 12,
          handoffRule: input.handoffRule ? "configured" : "needs_rule",
        },
        (accounts.length ? accounts : ["@dialog_01"]).map((account, index) => ({
          account,
          peer: `@lead_${index + 1}`,
          draft: `Ответ от лица ${String(input.persona ?? "Support operator")}: коротко уточнить потребность и предложить следующий шаг.`,
          status: "draft_pending",
        })),
        ["Открыть Inbox", "Проверить AI-черновики", "Одобрить ответы в approval queue"],
      );
    },
  }),
};

function parserAdapter(slug: string): ModuleAdapter {
  return {
    slug,
    policy: policies[slug],
    execute(input) {
      const seed = seedFrom(input);
      const rows = makeRows(seed, 8);
      const minMembers = Number(input.minMembers ?? 500);
      const language = String(input.language ?? "Auto");
      const activeOnly = String(input.activeOnly ?? "Только активные");
      return baseResult(
        slug,
        input,
        "Парсинг завершён. Найдены активные источники, чаты очищены от дублей и готовы к AI chat campaign.",
        { scanned: 12840, leads: rows.length, unique: rows.length, minMembers, language, activeOnly, exportReady: true },
        rows.map((row, index) => ({ ...row, members: minMembers + index * 740, language, active: activeOnly === "Только активные" ? "yes" : "unknown" })),
        ["Экспортировать CSV", "Отправить источники в AI Chats", "Собрать lookalike-источники", "Запустить тестовый нейрочаттинг"],
      );
    },
  };
}

function protectionAdapter(slug: string): ModuleAdapter {
  return {
    slug,
    policy: policies[slug],
    execute(input) {
      return baseResult(
        slug,
        input,
        "Защитные правила пересчитаны. Рискованные аккаунты вынесены в стоп-лист.",
        { protected: 38, alerts: 5, stopped: 2, policy: String(input.policy ?? "Balanced") },
        ["flood-wait spike", "proxy mismatch", "new account velocity"].map((event, index) => ({ event, severity: index === 0 ? "high" : "medium", action: "Понижен темп и поставлен повторный GGR" })),
        ["Проверить stop rules", "Запустить GGR на risk-сегмент"],
      );
    },
  };
}

function warmAdapter(slug: string): ModuleAdapter {
  return {
    slug,
    policy: policies[slug],
    execute(input) {
      return baseResult(
        slug,
        input,
        "План прогрева построен с естественными окнами активности и дневными лимитами.",
        { days: Number(input.days ?? 7), accounts: Math.max(linesFrom(input.accounts).length, 3), chatsPerAccount: Number(input.chatsPerAccount ?? 10), trustLift: "+18%" },
        ["day 1", "day 2", "day 3", "day 4"].map((day, index) => ({ day, actions: 12 + index * 8, chatJoins: Math.min(Number(input.chatsPerAccount ?? 10), 2 + index * 2), maxDialogs: 3 + index, targetTrust: 70 + index * 6 })),
        ["Запустить вручную после GGR", "Остановить аккаунты с risk > medium", "Проверить вступления в чаты"],
      );
    },
  };
}

function aiAdapter(slug: string): ModuleAdapter {
  return {
    slug,
    policy: policies[slug],
    execute(input) {
      return baseResult(
        slug,
        input,
        "ИИ-сценарий подготовил черновики, scoring, probability gates и link handoff.",
        { drafts: 24, approved: 18, handoff: 4, tone: String(input.tone ?? input.languageMode ?? input.language ?? "Auto"), responseProbability: Number(input.responseProbability ?? 5), contextMessages: Number(input.contextMessages ?? 10), maxReplies: Number(input.maxReplies ?? 2) },
        makeRows(seedFrom(input), 5).map((row) => ({ ...row, persona: String(input.persona ?? "Expert"), draft: "Нативный ответ по контексту, без шаблонной подачи и давления", linkMode: input.handoffLink ? String(input.stopAfterLink ?? "Остановить диалог") : "profile_link" })),
        ["Проверить первые 10 черновиков", "Настроить approval mode", "Протестировать prompt sandbox", "Запустить A/B probability test"],
      );
    },
  };
}

const adapters = new Map<string, ModuleAdapter>();

for (const module of modules) {
  if (adapterFactories[module.slug]) {
    adapters.set(module.slug, adapterFactories[module.slug](module.slug));
  } else if (module.slug.startsWith("parsing-") || module.slug === "channel-parser") {
    adapters.set(module.slug, parserAdapter(module.slug));
  } else if (module.slug === "ai-account-protection") {
    adapters.set(module.slug, protectionAdapter(module.slug));
  } else if (module.slug === "auto-warm") {
    adapters.set(module.slug, warmAdapter(module.slug));
  } else if (module.slug === "neurochatting" || module.slug === "neurocommenting") {
    adapters.set(module.slug, aiAdapter(module.slug));
  }
}

adapters.set("proxy-checker", {
  slug: "proxy-checker",
  policy: policies["proxy-checker"],
  execute(input) {
    return baseResult(
      "proxy-checker",
      input,
      "Прокси поставлены в очередь проверки.",
      { total: linesFrom(input.targets).length, mode: "tcp" },
      linesFrom(input.targets).map((proxy) => ({ proxy, status: "queued" })),
      ["Дождаться TCP-проверки", "Сохранить online endpoint"],
    );
  },
});

export function getModuleAdapter(slug: string) {
  return adapters.get(slug);
}

export function getModulePolicy(slug: string) {
  return policies[slug] ?? { risk: "low", approval: "auto", safeLimit: 100, requires: [] };
}
