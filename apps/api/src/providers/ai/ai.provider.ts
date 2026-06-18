export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** Краткое описание шаблона для понимания запроса (без чисел и цен). */
export interface AiTemplateContext {
  slug: string;
  name: string;
  description?: string;
  workType: string;
  /** Числовые параметры шаблона (variableKey формул) — что ИИ может извлечь из текста. */
  parameters: { key: string; label: string; unit?: string }[];
  /** Ключевые слова для сопоставления запроса с шаблоном. */
  keywords: string[];
}

export interface AiUnderstandInput {
  query: string;
  regionName?: string;
  templates: AiTemplateContext[];
}

/**
 * Результат «понимания» запроса. ИИ НЕ считает цены и количества —
 * только распознаёт намерение, подбирает шаблон и извлекает числовые параметры.
 * Все суммы считаются формулами и прайсами БД на стороне сервиса.
 */
export interface AiUnderstanding {
  /** Человеко-читаемое резюме того, как понят запрос. */
  summary: string;
  /** slug подобранного шаблона или null, если подходящего нет. */
  matchedSlug: string | null;
  /** Уверенность сопоставления, 0..1. */
  confidence: number;
  /** Извлечённые числовые параметры: variableKey → значение. */
  parameters: Record<string, number>;
  /** Предлагаемые этапы текстом, если шаблон не найден (без чисел). */
  proposedStages: { name: string; note?: string }[];
  /** Чем получен результат: реальной моделью или офлайн-эвристикой. */
  source: 'llm' | 'heuristic';
}

/** Контракт ИИ-агента: понимание свободного запроса пользователя. */
export interface AiProvider {
  understand(input: AiUnderstandInput): Promise<AiUnderstanding>;
}
