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

/** Один этап ориентировочной ИИ-оценки (когда готового сценария в БД нет). */
export interface AiEstimatedStage {
  name: string;
  note?: string;
  priceMin: number;
  priceMax: number;
}

/**
 * Ориентировочная оценка от ИИ для запросов без готового сценария в БД.
 * Это НЕ точный расчёт формулами — диапазоны для понимания порядка цен.
 */
export interface AiEstimate {
  stages: AiEstimatedStage[];
  stagedMin: number;
  stagedMax: number;
  turnkeyMin: number;
  turnkeyMax: number;
  /** Почему выгоднее заказывать по этапам, а не «под ключ». */
  whyCheaper: string;
  /** Допущения и что стоит уточнить. */
  assumptions?: string;
}

/**
 * Результат «понимания» запроса.
 * - Если найден шаблон БД (matchedSlug) — цены считаются формулами/прайсами на сервере.
 * - Иначе ИИ может вернуть ориентировочную оценку (estimate) с диапазонами.
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
  /** Предлагаемые этапы текстом, если шаблон не найден и нет оценки. */
  proposedStages: { name: string; note?: string }[];
  /** Ориентировочная оценка ИИ (используется, если matchedSlug = null). */
  estimate: AiEstimate | null;
  /** Чем получен результат: реальной моделью или офлайн-эвристикой. */
  source: 'llm' | 'heuristic';
}

/** Контракт ИИ-агента: понимание свободного запроса пользователя. */
export interface AiProvider {
  understand(input: AiUnderstandInput): Promise<AiUnderstanding>;
}
