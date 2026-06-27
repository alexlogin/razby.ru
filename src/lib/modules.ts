import {
  Activity,
  Bot,
  Cable,
  ChartNoAxesCombined,
  Copy,
  Flame,
  FolderTree,
  Gauge,
  HandHeart,
  Inbox,
  Map as MapIcon,
  MessageCircle,
  MessagesSquare,
  Radar,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Signal,
  UserRoundCog,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type ModuleCategory =
  | "Аккаунты"
  | "Парсинг"
  | "ИИ"
  | "Охваты"
  | "Защита"
  | "Инструменты";

export type ModuleField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
};

export type RazbyModule = {
  slug: string;
  title: string;
  shortTitle: string;
  category: ModuleCategory;
  description: string;
  outcome: string;
  price: string;
  icon: LucideIcon;
  fields: ModuleField[];
  metrics: Array<{ label: string; value: string }>;
};

export const modules: RazbyModule[] = [
  {
    slug: "mass-looking",
    title: "Масслукинг",
    shortTitle: "Stories views",
    category: "Охваты",
    description: "Массовые просмотры Stories у выбранных каналов и пользователей от подключённых аккаунтов.",
    outcome: "Очередь просмотров, отчёт по аккаунтам и статусам.",
    price: "$20",
    icon: Radar,
    metrics: [
      { label: "views/day", value: "24K" },
      { label: "safe pace", value: "92%" },
    ],
    fields: [
      { name: "targets", label: "Цели", type: "textarea", placeholder: "@channel_one\n@creator_two" },
      { name: "dailyLimit", label: "Лимит в день", type: "number", defaultValue: "1200" },
      { name: "pace", label: "Темп", type: "select", defaultValue: "Нормальный", options: ["Осторожный", "Нормальный", "Быстрый"] },
    ],
  },
  {
    slug: "ggr",
    title: "GGR Проверка",
    shortTitle: "Account rating",
    category: "Защита",
    description: "Оценка качества и живучести Telegram-аккаунтов перед нагрузкой.",
    outcome: "Рейтинг 1-10, GEO/прокси-сигналы, факторы риска и рекомендации по прогреву.",
    price: "$15",
    icon: Gauge,
    metrics: [
      { label: "risk model", value: "16+" },
      { label: "checks/hour", value: "180" },
    ],
    fields: [
      { name: "accounts", label: "Аккаунты", type: "textarea", placeholder: "@account или phone_id, по одному в строке" },
      { name: "mode", label: "Режим", type: "select", defaultValue: "Быстрая проверка", options: ["Быстрая проверка", "Глубокий аудит"] },
      { name: "geoPolicy", label: "GEO policy", type: "select", defaultValue: "Proxy matches account", options: ["Proxy matches account", "Mixed GEO", "Ignore GEO"] },
    ],
  },
  {
    slug: "neuro-dialogs",
    title: "НейроДиалоги",
    shortTitle: "AI dialogs",
    category: "ИИ",
    description: "ИИ-оператор для личных переписок с учётом контекста, оффера, ссылки и статуса лида.",
    outcome: "Черновики ответов, лид-статусы, link handoff и передача оператору.",
    price: "$35",
    icon: Bot,
    metrics: [
      { label: "reply SLA", value: "8 sec" },
      { label: "handoff", value: "auto" },
    ],
    fields: [
      { name: "offer", label: "Оффер", type: "textarea", placeholder: "Опишите продукт, тон и цель диалога" },
      { name: "language", label: "Язык", type: "select", defaultValue: "Auto", options: ["Auto", "RU", "EN", "UA"] },
      { name: "contextMessages", label: "Контекст сообщений", type: "number", defaultValue: "10" },
      { name: "maxReplies", label: "Ответов на человека", type: "number", defaultValue: "2" },
      { name: "handoffLink", label: "Ссылка/оффер", type: "text", placeholder: "https://t.me/+invite" },
      { name: "handoffScore", label: "Передавать оператору с score", type: "number", defaultValue: "78" },
    ],
  },
  {
    slug: "manager-telegram-accounts",
    title: "Менеджер аккаунтов",
    shortTitle: "Accounts",
    category: "Аккаунты",
    description: "Импорт session-аккаунтов, статусы, GEO, прокси, роли, профильные персоны и рабочие лимиты.",
    outcome: "Единая таблица аккаунтов с health score, proxy pool, нишевым оформлением и быстрыми действиями.",
    price: "included",
    icon: UserRoundCog,
    metrics: [
      { label: "accounts", value: "248" },
      { label: "healthy", value: "91%" },
    ],
    fields: [
      { name: "batch", label: "Session import", type: "textarea", placeholder: "session_string, @name, phone, geo, proxy-label" },
      { name: "defaultRole", label: "Роль", type: "select", defaultValue: "Worker", options: ["Worker", "Reserve", "Dialog", "Parser"] },
      { name: "proxyPool", label: "Proxy pool", type: "textarea", placeholder: "socks5://user:pass@host:1080" },
      { name: "geoStrategy", label: "GEO strategy", type: "select", defaultValue: "Match proxy and account", options: ["Match proxy and account", "One proxy per 5 accounts", "Manual"] },
      { name: "identityTheme", label: "Профильная ниша", type: "text", placeholder: "crypto influencers, education experts, beauty creators" },
    ],
  },
  {
    slug: "account-takeover-protection",
    title: "Защита купленного аккаунта",
    shortTitle: "Seller protection",
    category: "Защита",
    description: "Пошаговая защита Telegram-аккаунта после покупки: сессии, облачный пароль, привязки, recovery и риски продавца.",
    outcome: "Чеклист защиты, риск возврата аккаунта продавцом и действия перед запуском в работу.",
    price: "$15",
    icon: ShieldAlert,
    metrics: [
      { label: "risk checks", value: "18" },
      { label: "takeover", value: "guard" },
    ],
    fields: [
      { name: "accounts", label: "Аккаунты", type: "textarea", placeholder: "@worker_01, phone_id или inventory id" },
      { name: "marketSource", label: "Источник покупки", type: "select", defaultValue: "Marketplace", options: ["Marketplace", "Private seller", "Own farming", "Unknown"] },
      { name: "securityState", label: "Что уже сделано", type: "textarea", placeholder: "Сменил пароль, проверил email, убрал чужие сессии..." },
      { name: "riskTolerance", label: "Политика риска", type: "select", defaultValue: "Conservative", options: ["Conservative", "Balanced", "Fast check"] },
    ],
  },
  {
    slug: "massreact",
    title: "МассРеакции",
    shortTitle: "Reactions",
    category: "Охваты",
    description: "Распределённые реакции на посты с лимитами, задержками и отчётом по аккаунтам.",
    outcome: "План реакций, очередь и сводка выполненных действий.",
    price: "$25",
    icon: HandHeart,
    metrics: [
      { label: "queue", value: "4.8K" },
      { label: "success", value: "96%" },
    ],
    fields: [
      { name: "postLinks", label: "Посты", type: "textarea", placeholder: "https://t.me/channel/123" },
      { name: "reactions", label: "Реакции", type: "text", defaultValue: "👍 🔥 ❤️" },
      { name: "perPost", label: "На пост", type: "number", defaultValue: "150" },
    ],
  },
  {
    slug: "bulk-story-copy",
    title: "Копирование Stories",
    shortTitle: "Story copy",
    category: "Охваты",
    description: "Массовое копирование и публикация Stories по выбранным аккаунтам с лимитами, расписанием и ручным подтверждением.",
    outcome: "Очередь Stories, распределение по аккаунтам, расписание и approval перед публикацией.",
    price: "$25",
    icon: Copy,
    metrics: [
      { label: "stories/run", value: "120" },
      { label: "approval", value: "manual" },
    ],
    fields: [
      { name: "storyLinks", label: "Stories / источники", type: "textarea", placeholder: "https://t.me/c/...\n@source/story/123" },
      { name: "targetAccounts", label: "Аккаунты для публикации", type: "textarea", placeholder: "@worker_01\n@worker_02" },
      { name: "captionMode", label: "Подпись", type: "select", defaultValue: "Сохранить оригинал", options: ["Сохранить оригинал", "Сгенерировать AI-варианты", "Без подписи"] },
      { name: "pace", label: "Темп публикации", type: "select", defaultValue: "Осторожный", options: ["Осторожный", "Нормальный", "Быстрый"] },
    ],
  },
  {
    slug: "parsing-comments",
    title: "Парсер комментариев",
    shortTitle: "Comment parser",
    category: "Парсинг",
    description: "Сбор активных пользователей из комментариев к постам и обсуждениям каналов.",
    outcome: "Лид-лист с источником, активностью и тегами.",
    price: "$8",
    icon: MessageCircle,
    metrics: [
      { label: "leads/run", value: "1.2K" },
      { label: "dedupe", value: "on" },
    ],
    fields: [
      { name: "channels", label: "Каналы", type: "textarea", placeholder: "@source_channel\nhttps://t.me/source/120" },
      { name: "keywords", label: "Ключевые слова", type: "text", placeholder: "куплю, интерес, цена" },
    ],
  },
  {
    slug: "parsing-messages",
    title: "Парсер по сообщениям",
    shortTitle: "Message parser",
    category: "Парсинг",
    description: "Поиск пользователей по ключевым словам в сообщениях чатов и каналов.",
    outcome: "Сегмент пользователей с контекстом сообщения.",
    price: "$8",
    icon: ScanSearch,
    metrics: [
      { label: "sources", value: "80" },
      { label: "match rate", value: "18%" },
    ],
    fields: [
      { name: "sources", label: "Источники", type: "textarea", placeholder: "@chat_one\n@chat_two" },
      { name: "query", label: "Запрос", type: "text", placeholder: "нужен подрядчик OR ищу сервис" },
      { name: "days", label: "Период, дней", type: "number", defaultValue: "30" },
    ],
  },
  {
    slug: "parsing-users",
    title: "Парсер пользователей",
    shortTitle: "User parser",
    category: "Парсинг",
    description: "Сбор участников из групп и каналов с дедупликацией и скорингом.",
    outcome: "Чистая база пользователей для дальнейшей обработки.",
    price: "$8",
    icon: UsersRound,
    metrics: [
      { label: "dedupe", value: "98%" },
      { label: "export", value: ".csv" },
    ],
    fields: [
      { name: "groups", label: "Группы/каналы", type: "textarea", placeholder: "@group_one\n@channel_two" },
      { name: "minActivity", label: "Мин. активность", type: "select", defaultValue: "Любая", options: ["Любая", "Средняя", "Высокая"] },
    ],
  },
  {
    slug: "parsing-groups",
    title: "Парсер групп",
    shortTitle: "Group parser",
    category: "Парсинг",
    description: "Поиск Telegram-групп по нишам, языку, размеру, активности и seed-источникам.",
    outcome: "Список активных групп с метриками, языком и пригодностью для AI chat кампаний.",
    price: "$8",
    icon: Signal,
    metrics: [
      { label: "clusters", value: "598" },
      { label: "freshness", value: "daily" },
    ],
    fields: [
      { name: "niche", label: "Ниша", type: "text", placeholder: "crypto, education, beauty" },
      { name: "minMembers", label: "Мин. участников", type: "number", defaultValue: "1000" },
      { name: "language", label: "Язык", type: "select", defaultValue: "Auto", options: ["Auto", "RU", "EN", "ES", "PT"] },
      { name: "activeOnly", label: "Активность", type: "select", defaultValue: "Только активные", options: ["Только активные", "Все найденные"] },
    ],
  },
  {
    slug: "ai-account-protection",
    title: "ИИ Защита аккаунта",
    shortTitle: "Protection",
    category: "Защита",
    description: "Мониторинг рисков, лимитов и событий аккаунтов перед запуском кампаний.",
    outcome: "Risk board, рекомендации и стоп-лист аккаунтов.",
    price: "$15",
    icon: ShieldCheck,
    metrics: [
      { label: "risk alerts", value: "real-time" },
      { label: "stop rules", value: "12" },
    ],
    fields: [
      { name: "policy", label: "Политика защиты", type: "select", defaultValue: "Balanced", options: ["Conservative", "Balanced", "Aggressive"] },
      { name: "notify", label: "Уведомления", type: "select", defaultValue: "Dashboard", options: ["Dashboard", "Telegram", "Email"] },
    ],
  },
  {
    slug: "channel-parser",
    title: "Парсер каналов",
    shortTitle: "Channel parser",
    category: "Парсинг",
    description: "Поиск каналов и чатов по ключевым словам, seed-источникам, языку, размеру и активности.",
    outcome: "Карта источников, активные чаты, категории и экспорт в AI chat campaign.",
    price: "$8",
    icon: MapIcon,
    metrics: [
      { label: "channels", value: "500K" },
      { label: "posts", value: "50M" },
    ],
    fields: [
      { name: "keywords", label: "Ключевые слова", type: "text", placeholder: "маркетинг, крипто, образование" },
      { name: "category", label: "Категория", type: "select", defaultValue: "Все", options: ["Все", "Бизнес", "Крипто", "Образование", "Lifestyle"] },
      { name: "seedSources", label: "Seed источники", type: "textarea", placeholder: "@competitor_channel\n@private_chat" },
      { name: "minMembers", label: "Мин. участников", type: "number", defaultValue: "500" },
      { name: "language", label: "Язык", type: "select", defaultValue: "Auto", options: ["Auto", "RU", "EN", "ES", "PT"] },
      { name: "activeOnly", label: "Активность", type: "select", defaultValue: "Только активные", options: ["Только активные", "Все найденные"] },
    ],
  },
  {
    slug: "telegram-folders",
    title: "Папки Telegram",
    shortTitle: "Folders",
    category: "Инструменты",
    description: "Автоматическая сборка Telegram-папок из каналов и чатов по нише, языку, источникам и назначению команды.",
    outcome: "План папок, список каналов/чатов, распределение по аккаунтам и готовая очередь для worker.",
    price: "$8",
    icon: FolderTree,
    metrics: [
      { label: "folders", value: "auto" },
      { label: "sources", value: "bulk" },
    ],
    fields: [
      { name: "folderName", label: "Название папки", type: "text", defaultValue: "Competitors / niche watch" },
      { name: "sources", label: "Каналы и чаты", type: "textarea", placeholder: "@channel_one\n@chat_two\nhttps://t.me/source" },
      { name: "assignAccounts", label: "Аккаунты", type: "textarea", placeholder: "@worker_01\n@parser_02" },
      { name: "folderMode", label: "Режим", type: "select", defaultValue: "Каналы и чаты", options: ["Каналы и чаты", "Только каналы", "Только чаты"] },
    ],
  },
  {
    slug: "auto-warm",
    title: "Автопрогрев аккаунтов",
    shortTitle: "Warm-up",
    category: "Аккаунты",
    description: "План естественной активности, вступлений в чаты и подготовки аккаунтов перед рабочей нагрузкой.",
    outcome: "Расписание активности, join-plan, trust score и журнал прогрева.",
    price: "$30",
    icon: Flame,
    metrics: [
      { label: "trust lift", value: "+22%" },
      { label: "pace", value: "safe" },
    ],
    fields: [
      { name: "accounts", label: "Аккаунты", type: "textarea", placeholder: "@worker_one\n@worker_two" },
      { name: "days", label: "Дней прогрева", type: "number", defaultValue: "7" },
      { name: "style", label: "Профиль активности", type: "select", defaultValue: "Natural", options: ["Natural", "Quiet", "High-touch"] },
      { name: "chatsPerAccount", label: "Чатов на аккаунт", type: "number", defaultValue: "10" },
    ],
  },
  {
    slug: "neurochatting",
    title: "Нейрочаттинг",
    shortTitle: "AI Chats",
    category: "ИИ",
    description: "ИИ-ответы в группах по ключевым словам с persona prompt, вероятностью ответа, контекстом и link handoff.",
    outcome: "Кандидаты ответов, очередь публикаций, лиды из чатов и контролируемый перевод в канал.",
    price: "$40",
    icon: MessagesSquare,
    metrics: [
      { label: "intent", value: "AI" },
      { label: "approval", value: "manual/auto" },
    ],
    fields: [
      { name: "chats", label: "Чаты", type: "textarea", placeholder: "@chat_one\n@chat_two" },
      { name: "persona", label: "Персона", type: "text", defaultValue: "Crypto expert" },
      { name: "prompt", label: "Промпт", type: "textarea", placeholder: "Отвечай на языке собеседника, 1-2 предложения, дружелюбно и релевантно вопросу" },
      { name: "languageMode", label: "Язык", type: "select", defaultValue: "Auto", options: ["Auto", "RU", "EN", "Manual RU"] },
      { name: "contextMessages", label: "Контекст сообщений", type: "number", defaultValue: "10" },
      { name: "responseProbability", label: "Вероятность ответа, %", type: "number", defaultValue: "5" },
      { name: "maxReplies", label: "Ответов на человека", type: "number", defaultValue: "2" },
      { name: "handoffLink", label: "Ссылка/профиль", type: "text", placeholder: "https://t.me/+invite или ссылка в профиле" },
      { name: "stopAfterLink", label: "После ссылки", type: "select", defaultValue: "Остановить диалог", options: ["Остановить диалог", "Продолжать мягко"] },
      { name: "approval", label: "Публикация", type: "select", defaultValue: "С подтверждением", options: ["С подтверждением", "Автоматически"] },
    ],
  },
  {
    slug: "unified-inbox",
    title: "Единый Inbox",
    shortTitle: "Inbox",
    category: "ИИ",
    description: "Все входящие диалоги из подключённых Telegram-аккаунтов в одном окне: AI-черновики, статусы, handoff и approval.",
    outcome: "Единая очередь сообщений, AI-черновики ответов и ручное подтверждение перед отправкой.",
    price: "$35",
    icon: Inbox,
    metrics: [
      { label: "accounts", value: "multi" },
      { label: "drafts", value: "AI" },
    ],
    fields: [
      { name: "accounts", label: "Аккаунты", type: "textarea", placeholder: "@dialog_01\n@dialog_02" },
      { name: "persona", label: "Персона", type: "text", defaultValue: "Support operator" },
      { name: "inboxPolicy", label: "Политика ответов", type: "select", defaultValue: "Только черновики", options: ["Только черновики", "С подтверждением", "Автоответ на low-risk"] },
      { name: "handoffRule", label: "Передача оператору", type: "text", placeholder: "Если лид просит цену, созвон или оплату" },
    ],
  },
  {
    slug: "neurocommenting",
    title: "Нейрокомментинг",
    shortTitle: "AI Comments",
    category: "ИИ",
    description: "ИИ-комментарии под постами каналов с учётом темы, оффера и ограничений.",
    outcome: "Сгенерированные комментарии, антидубли и журнал публикаций.",
    price: "$40",
    icon: Zap,
    metrics: [
      { label: "tone lock", value: "on" },
      { label: "uniqueness", value: "94%" },
    ],
    fields: [
      { name: "channels", label: "Каналы", type: "textarea", placeholder: "@channel_one\n@channel_two" },
      { name: "tone", label: "Тон", type: "select", defaultValue: "Экспертный", options: ["Экспертный", "Нативный", "Дружелюбный", "Провокационный"] },
      { name: "prompt", label: "Инструкция", type: "textarea", placeholder: "Комментируй по теме поста, добавляй полезную мысль" },
    ],
  },
];

export const moduleMap = new Map(modules.map((module) => [module.slug, module]));

export const navigationGroups = [
  { title: "Рабочее", slugs: ["manager-telegram-accounts", "account-takeover-protection", "auto-warm", "ai-account-protection", "ggr", "telegram-folders"] },
  { title: "Парсинг", slugs: ["channel-parser", "parsing-groups", "parsing-users", "parsing-comments", "parsing-messages"] },
  { title: "ИИ и охваты", slugs: ["unified-inbox", "neurocommenting", "neurochatting", "neuro-dialogs", "massreact", "bulk-story-copy", "mass-looking"] },
];

export const publicTools = [
  {
    slug: "channel-map",
    title: "Карта каналов",
    description: "Открытый каталог каналов и ниш для ресерча перед парсингом.",
    icon: ChartNoAxesCombined,
  },
  {
    slug: "proxy-checker",
    title: "Чекер прокси",
    description: "Проверка формата, доступности и задержки HTTP/SOCKS5/MTProxy.",
    icon: Cable,
  },
  {
    slug: "activity-limits",
    title: "Лимиты и токены",
    description: "Видимость дневных лимитов, токенов ИИ и безопасного темпа.",
    icon: Activity,
  },
];

export function getModule(slug: string) {
  return moduleMap.get(slug);
}
