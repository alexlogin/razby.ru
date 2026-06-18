import type { Role } from './roles.js';

/** Полезная нагрузка access-токена. */
export interface JwtPayload {
  sub: string; // userId
  role: Role;
  email: string;
  tv: number; // tokenVersion — для инвалидации
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Этап в ответе ИИ-агента (числа — из формул и прайсов БД). */
export interface AiAnalyzeStage {
  code: string;
  order: number;
  name: string;
  workType: string;
  estimatedDays: number;
  materialsCost: number;
  worksCost: number;
  total: number;
  /** true — не хватило параметров для расчёта материалов этапа. */
  needsInput: boolean;
}

export interface AiAnalyzePricing {
  currency: string;
  subtotal: number;
  commission: number;
  /** Стоимость «по этапам» (через платформу). */
  stagedTotal: number;
  /** Ориентир «под ключ». */
  turnkeyTotal: number;
  savings: number;
  savingsPercent: number;
}

/** Результат работы ИИ-агента по свободному запросу пользователя. */
export interface AiAnalyzeResult {
  query: string;
  summary: string;
  source: 'llm' | 'heuristic';
  matched: boolean;
  confidence: number;
  template: { slug: string; name: string; description?: string } | null;
  /** Извлечённые из запроса числовые параметры (variableKey → значение). */
  parameters: Record<string, number>;
  /** Параметры шаблона, которые стоит уточнить для точного расчёта. */
  missingParameters: { key: string; label: string; unit?: string }[];
  /** Предлагаемые этапы текстом, если готовый шаблон не найден. */
  proposedStages: { name: string; note?: string }[];
  stages: AiAnalyzeStage[];
  pricing: AiAnalyzePricing | null;
  /** Подсказка для финального действия: создать проект по шаблону (после регистрации). */
  cta: { templateSlug: string } | null;
}
