import { Logger } from '@nestjs/common';
import {
  AiProvider,
  AiUnderstanding,
  AiUnderstandInput,
} from './ai.provider';
import { HeuristicAiProvider } from './heuristic-ai.provider';

interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  appUrl: string;
}

/**
 * Понимание запроса через OpenRouter (OpenAI-совместимый API).
 * По умолчанию используется бесплатная модель (AI_MODEL). Модель ТОЛЬКО
 * распознаёт намерение, подбирает шаблон и извлекает числовые параметры —
 * цены и количества считаются формулами на стороне сервиса.
 * При любой ошибке/таймауте мягко откатывается на офлайн-эвристику.
 */
export class OpenRouterAiProvider implements AiProvider {
  private readonly logger = new Logger(OpenRouterAiProvider.name);

  constructor(
    private readonly config: OpenRouterConfig,
    private readonly fallback: HeuristicAiProvider,
  ) {}

  async understand(input: AiUnderstandInput): Promise<AiUnderstanding> {
    try {
      const json = await this.callModel(input);
      return this.normalize(json, input);
    } catch (e) {
      this.logger.warn(`OpenRouter недоступен, фолбэк на эвристику: ${(e as Error).message}`);
      return this.fallback.understand(input);
    }
  }

  private buildSystemPrompt(input: AiUnderstandInput): string {
    const templates = input.templates
      .map(
        (t) =>
          `- slug="${t.slug}", название="${t.name}", тип=${t.workType}, ключевые слова=[${t.keywords.join(
            ', ',
          )}], параметры=[${t.parameters.map((p) => `${p.key}(${p.label}${p.unit ? ', ' + p.unit : ''})`).join('; ')}]`,
      )
      .join('\n');
    return [
      'Ты — ассистент строительной платформы Razby.ru. Платформа разбивает заказ на этапы и считает смету формулами.',
      'Твоя задача — ТОЛЬКО понять запрос пользователя: подобрать наиболее подходящий шаблон из списка и извлечь числовые параметры из текста.',
      'Категорически НЕ придумывай цены, количества материалов и числовые сметы — это делает платформа формулами.',
      '',
      'Доступные шаблоны:',
      templates || '(нет шаблонов)',
      '',
      'Верни СТРОГО один JSON-объект без markdown и пояснений в формате:',
      '{"summary": string (кратко по-русски, как понят запрос), "matchedSlug": string|null (slug шаблона или null), "confidence": number (0..1), "parameters": {<variableKey>: number} (только извлечённые из текста параметры подобранного шаблона), "proposedStages": [{"name": string, "note"?: string}] (заполняй только если matchedSlug=null)}',
    ].join('\n');
  }

  private async callModel(input: AiUnderstandInput): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          // Рекомендуемые OpenRouter заголовки атрибуции.
          'HTTP-Referer': this.config.appUrl,
          'X-Title': 'Razby.ru',
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: this.buildSystemPrompt(input) },
            {
              role: 'user',
              content: input.regionName
                ? `Регион: ${input.regionName}. Запрос: ${input.query}`
                : `Запрос: ${input.query}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('пустой ответ модели');
      return this.parseJson(content);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Достаёт JSON даже если модель обернула его в текст/markdown. */
  private parseJson(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
      throw new Error('не удалось разобрать JSON ответа модели');
    }
  }

  private normalize(raw: unknown, input: AiUnderstandInput): AiUnderstanding {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const slug = typeof obj.matchedSlug === 'string' ? obj.matchedSlug : null;
    // Доверяем только существующим slug'ам.
    const validSlug = slug && input.templates.some((t) => t.slug === slug) ? slug : null;

    const parameters: Record<string, number> = {};
    if (obj.parameters && typeof obj.parameters === 'object') {
      for (const [k, v] of Object.entries(obj.parameters as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n)) parameters[k] = n;
      }
    }

    const proposedStages = Array.isArray(obj.proposedStages)
      ? (obj.proposedStages as unknown[])
          .map((s) => {
            const so = (s ?? {}) as Record<string, unknown>;
            return {
              name: String(so.name ?? '').trim(),
              note: so.note ? String(so.note) : undefined,
            };
          })
          .filter((s) => s.name)
      : [];

    const confidence = Number(obj.confidence);
    return {
      summary: typeof obj.summary === 'string' && obj.summary.trim()
        ? obj.summary.trim()
        : `Запрос: «${input.query.trim()}».`,
      matchedSlug: validSlug,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : validSlug ? 0.6 : 0,
      parameters,
      proposedStages: validSlug ? [] : proposedStages,
      source: 'llm',
    };
  }
}
