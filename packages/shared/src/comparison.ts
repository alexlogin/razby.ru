/**
 * Контракты алгоритма сравнения предложений.
 * Сам алгоритм реализован на бэкенде (apps/api/src/offers/comparison.service.ts).
 */

export const OfferRecommendation = {
  CHEAPEST: 'CHEAPEST', // самый дешёвый
  OPTIMAL: 'OPTIMAL', // оптимальный (взвешенный)
  FASTEST: 'FASTEST', // самый быстрый
  TOP_RATED: 'TOP_RATED', // максимальный рейтинг
} as const;
export type OfferRecommendation = (typeof OfferRecommendation)[keyof typeof OfferRecommendation];

export const RECOMMENDATION_LABELS_RU: Record<OfferRecommendation, string> = {
  CHEAPEST: 'Самый дешёвый',
  OPTIMAL: 'Оптимальный',
  FASTEST: 'Самый быстрый',
  TOP_RATED: 'Максимальный рейтинг',
};

/** Веса критериев оптимального варианта (в сумме 1). */
export interface ComparisonWeights {
  price: number;
  rating: number;
  reviews: number;
  completedOrders: number;
  verified: number;
  warranty: number;
  onTimeRate: number;
  cancelRate: number;
  distance: number;
}

export const DEFAULT_COMPARISON_WEIGHTS: ComparisonWeights = {
  price: 0.3,
  rating: 0.18,
  reviews: 0.08,
  completedOrders: 0.1,
  verified: 0.1,
  warranty: 0.07,
  onTimeRate: 0.1,
  cancelRate: 0.04,
  distance: 0.03,
};

export interface ScoredOffer {
  offerId: string;
  score: number; // 0..100, чем больше — тем лучше
  breakdown: Partial<Record<keyof ComparisonWeights, number>>;
  recommendations: OfferRecommendation[];
}
