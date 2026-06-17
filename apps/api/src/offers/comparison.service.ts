import { Injectable } from '@nestjs/common';
import {
  DEFAULT_COMPARISON_WEIGHTS,
  OfferRecommendation,
  type ComparisonWeights,
  type ScoredOffer,
} from '@razby/shared';

export interface OfferForScoring {
  id: string;
  price: number;
  durationDays: number | null;
  availableDate: Date | null;
  warrantyMonths: number;
  provider: {
    ratingAvg: number;
    reviewsCount: number;
    completedOrders: number;
    cancelledOrders: number;
    onTimeRate: number;
    verified: boolean;
    distanceKm: number | null;
  };
}

interface Range {
  min: number;
  max: number;
}

@Injectable()
export class ComparisonService {
  private range(values: number[]): Range {
    const filtered = values.filter((v) => Number.isFinite(v));
    if (filtered.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...filtered), max: Math.max(...filtered) };
  }

  /** Нормализация «больше — лучше» в 0..1. */
  private normHigher(value: number, r: Range): number {
    if (r.max === r.min) return 1;
    return (value - r.min) / (r.max - r.min);
  }

  /** Нормализация «меньше — лучше» в 0..1. */
  private normLower(value: number, r: Range): number {
    if (r.max === r.min) return 1;
    return (r.max - value) / (r.max - r.min);
  }

  /**
   * Сравнение предложений. Учитывает не только цену:
   * рейтинг, отзывы, завершённые заказы, верификацию, гарантию,
   * соблюдение сроков, отмены и расстояние до объекта.
   */
  compare(
    offers: OfferForScoring[],
    weights: ComparisonWeights = DEFAULT_COMPARISON_WEIGHTS,
  ): ScoredOffer[] {
    if (offers.length === 0) return [];

    const priceR = this.range(offers.map((o) => o.price));
    const reviewsR = this.range(offers.map((o) => o.provider.reviewsCount));
    const completedR = this.range(offers.map((o) => o.provider.completedOrders));
    const warrantyR = this.range(offers.map((o) => o.warrantyMonths));
    const distanceR = this.range(
      offers.map((o) => o.provider.distanceKm).filter((d): d is number => d != null),
    );

    const scored: ScoredOffer[] = offers.map((o) => {
      const cancelTotal = o.provider.completedOrders + o.provider.cancelledOrders;
      const cancelRate = cancelTotal > 0 ? o.provider.cancelledOrders / cancelTotal : 0;

      const breakdown = {
        price: this.normLower(o.price, priceR),
        rating: o.provider.ratingAvg / 5,
        reviews: this.normHigher(o.provider.reviewsCount, reviewsR),
        completedOrders: this.normHigher(o.provider.completedOrders, completedR),
        verified: o.provider.verified ? 1 : 0,
        warranty: this.normHigher(o.warrantyMonths, warrantyR),
        onTimeRate: Math.min(Math.max(o.provider.onTimeRate, 0), 1),
        cancelRate: 1 - cancelRate,
        distance:
          o.provider.distanceKm == null ? 0.5 : this.normLower(o.provider.distanceKm, distanceR),
      };

      const score =
        (breakdown.price * weights.price +
          breakdown.rating * weights.rating +
          breakdown.reviews * weights.reviews +
          breakdown.completedOrders * weights.completedOrders +
          breakdown.verified * weights.verified +
          breakdown.warranty * weights.warranty +
          breakdown.onTimeRate * weights.onTimeRate +
          breakdown.cancelRate * weights.cancelRate +
          breakdown.distance * weights.distance) *
        100;

      return {
        offerId: o.id,
        score: Number(score.toFixed(2)),
        breakdown,
        recommendations: [],
      };
    });

    this.assignRecommendations(offers, scored);
    return scored.sort((a, b) => b.score - a.score);
  }

  private assignRecommendations(offers: OfferForScoring[], scored: ScoredOffer[]): void {
    const byId = new Map(scored.map((s) => [s.offerId, s]));

    const cheapest = [...offers].sort((a, b) => a.price - b.price)[0];
    if (cheapest) byId.get(cheapest.id)?.recommendations.push(OfferRecommendation.CHEAPEST);

    const fastest = [...offers].sort((a, b) => this.speedKey(a) - this.speedKey(b))[0];
    if (fastest) byId.get(fastest.id)?.recommendations.push(OfferRecommendation.FASTEST);

    const topRated = [...offers].sort(
      (a, b) =>
        b.provider.ratingAvg - a.provider.ratingAvg ||
        b.provider.reviewsCount - a.provider.reviewsCount,
    )[0];
    if (topRated) byId.get(topRated.id)?.recommendations.push(OfferRecommendation.TOP_RATED);

    const optimal = [...scored].sort((a, b) => b.score - a.score)[0];
    if (optimal) optimal.recommendations.push(OfferRecommendation.OPTIMAL);
  }

  /** Ключ скорости: продолжительность + срок до доступной даты. */
  private speedKey(o: OfferForScoring): number {
    const duration = o.durationDays ?? 999;
    const wait = o.availableDate
      ? Math.max(0, (o.availableDate.getTime() - Date.now()) / 86_400_000)
      : 30;
    return duration + wait;
  }
}
