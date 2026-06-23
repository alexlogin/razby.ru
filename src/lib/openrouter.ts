import { getOpenRouterIntegration } from "@/lib/integrations";
import type { ModuleExecutionResult, ModuleInput } from "@/lib/module-adapters";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function readContent(response: OpenRouterChatResponse) {
  return response.choices?.[0]?.message?.content?.trim() ?? "";
}

async function postChat(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: OpenRouterMessage[];
  maxTokens?: number;
}) {
  const response = await fetch(`${cleanBaseUrl(input.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "Razby",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      max_tokens: input.maxTokens ?? 220,
      temperature: 0.45,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.error?.message ?? `OpenRouter request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as OpenRouterChatResponse;
}

function buildPrompt(slug: string, input: ModuleInput, result: ModuleExecutionResult) {
  const offer = String(input.offer ?? input.handoffLink ?? input.channels ?? input.chats ?? "");
  const persona = String(input.persona ?? input.tone ?? "Telegram growth expert");
  const instruction = String(input.prompt ?? "Сформируй короткий нативный ответ без давления.");
  const targets = result.rows
    .slice(0, 4)
    .map((row) => `${row.username ?? row.target ?? "lead"}: ${row.bio ?? row.draft ?? "нет контекста"}`)
    .join("\n");

  return [
    `Модуль: ${slug}`,
    `Персона: ${persona}`,
    `Оффер/ссылка: ${offer}`,
    `Инструкция пользователя: ${instruction}`,
    "Сгенерируй JSON-массив из 4 объектов.",
    "Поля объекта: username, draft, reason.",
    "draft: 1-2 коротких предложения на русском, естественно, без спама и обещаний.",
    "reason: почему ответ релевантен.",
    "Контекст:",
    targets || "Контекст отсутствует.",
  ].join("\n");
}

function parseDrafts(content: string) {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  const raw = jsonMatch?.[0] ?? content;

  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        username: String(item.username ?? ""),
        draft: String(item.draft ?? ""),
        reason: String(item.reason ?? ""),
      }))
      .filter((item) => item.draft);
  } catch {
    return [];
  }
}

export async function testOpenRouter(workspaceId: string) {
  const config = await getOpenRouterIntegration(workspaceId);

  if (!config?.apiKey) {
    throw new Error("OpenRouter API key is not configured");
  }

  const response = await postChat({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    maxTokens: 32,
    messages: [
      { role: "system", content: "You are a concise API health checker." },
      { role: "user", content: "Reply with exactly: Razby OpenRouter OK" },
    ],
  });

  return {
    provider: "openrouter",
    label: config.label,
    model: response.model ?? config.model,
    reply: readContent(response),
    usage: response.usage ?? null,
  };
}

export async function enrichAiModuleResultWithOpenRouter(input: {
  workspaceId: string;
  slug: string;
  moduleInput: ModuleInput;
  result: ModuleExecutionResult;
}) {
  if (!["neurochatting", "neurocommenting", "neuro-dialogs"].includes(input.slug)) {
    return input.result;
  }

  const config = await getOpenRouterIntegration(input.workspaceId);

  if (!config?.apiKey) {
    return {
      ...input.result,
      stats: {
        ...input.result.stats,
        aiProvider: "not_configured",
      },
      nextActions: ["Добавьте OpenRouter API key в Admin.", ...input.result.nextActions],
    };
  }

  const response = await postChat({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    messages: [
      {
        role: "system",
        content: "Ты AI-оператор Razby. Возвращай только валидный JSON без markdown.",
      },
      {
        role: "user",
        content: buildPrompt(input.slug, input.moduleInput, input.result),
      },
    ],
  });

  const content = readContent(response);
  const drafts = parseDrafts(content);
  const rows = drafts.length
    ? input.result.rows.map((row, index) => ({
        ...row,
        draft: drafts[index % drafts.length]?.draft ?? row.draft,
        aiReason: drafts[index % drafts.length]?.reason ?? "OpenRouter draft",
        aiProvider: "openrouter",
      }))
    : input.result.rows;

  return {
    ...input.result,
    summary: `${input.result.summary} OpenRouter сгенерировал реальные AI-черновики.`,
    stats: {
      ...input.result.stats,
      aiProvider: "openrouter",
      aiModel: response.model ?? config.model,
      aiDrafts: drafts.length || rows.length,
      aiTokens: response.usage?.total_tokens ?? 0,
    },
    rows,
    nextActions: ["Проверить реальные AI-черновики перед публикацией.", ...input.result.nextActions],
  };
}

export async function generateInboxDraft(input: {
  workspaceId: string;
  peerTitle: string;
  latestMessage: string;
  persona?: string;
  handoffRule?: string;
}) {
  const config = await getOpenRouterIntegration(input.workspaceId);
  const fallback = `Здравствуйте. Вижу ваш вопрос: "${input.latestMessage.slice(0, 120)}". Уточните, пожалуйста, какой результат вы хотите получить, и я подскажу следующий шаг.`;

  if (!config?.apiKey) {
    return {
      draft: fallback,
      provider: "local",
      reason: "OpenRouter не настроен, создан безопасный локальный черновик.",
    };
  }

  const response = await postChat({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    maxTokens: 160,
    messages: [
      {
        role: "system",
        content:
          "Ты оператор Telegram-переписки. Пиши коротко, естественно, без давления, без спама, без обещаний результата. Верни только текст ответа.",
      },
      {
        role: "user",
        content: [
          `Собеседник: ${input.peerTitle}`,
          `Персона оператора: ${input.persona || "Razby operator"}`,
          `Правило передачи оператору: ${input.handoffRule || "Если собеседник просит цену, оплату или созвон, мягко передай оператору."}`,
          `Последнее сообщение: ${input.latestMessage}`,
          "Сформулируй один короткий ответ на русском.",
        ].join("\n"),
      },
    ],
  });

  return {
    draft: readContent(response) || fallback,
    provider: "openrouter",
    model: response.model ?? config.model,
    usage: response.usage ?? null,
  };
}
