import { OfferRecommendation } from '@razby/shared';
import { ComparisonService, type OfferForScoring } from './comparison.service';

function offer(id: string, price: number, rating: number, opts: Partial<OfferForScoring['provider']> = {}, durationDays = 3): OfferForScoring {
  return {
    id,
    price,
    durationDays,
    availableDate: null,
    warrantyMonths: 12,
    provider: {
      ratingAvg: rating,
      reviewsCount: 10,
      completedOrders: 20,
      cancelledOrders: 1,
      onTimeRate: 0.9,
      verified: true,
      distanceKm: 30,
      ...opts,
    },
  };
}

describe('ComparisonService (сравнение предложений)', () => {
  const service = new ComparisonService();

  it('назначает четыре типа рекомендаций', () => {
    const result = service.compare([
      offer('a', 42000, 4.8, { verified: true, reviewsCount: 47, completedOrders: 53 }, 2),
      offer('b', 35000, 4.3, { verified: true, reviewsCount: 18, completedOrders: 22 }, 4),
      offer('c', 31000, 0, { verified: false, reviewsCount: 0, completedOrders: 0 }, 5),
    ]);
    const flat = result.flatMap((r) => r.recommendations.map((rec) => `${r.offerId}:${rec}`));
    expect(flat).toContain(`c:${OfferRecommendation.CHEAPEST}`);
    expect(flat).toContain(`a:${OfferRecommendation.FASTEST}`);
    expect(flat).toContain(`a:${OfferRecommendation.TOP_RATED}`);
    expect(result.some((r) => r.recommendations.includes(OfferRecommendation.OPTIMAL))).toBe(true);
  });

  it('учитывает не только цену: дешёвый неверифицированный проигрывает по score', () => {
    const result = service.compare([
      offer('cheap_bad', 31000, 0, { verified: false, reviewsCount: 0, completedOrders: 0 }),
      offer('mid_good', 35000, 4.3, { verified: true }),
    ]);
    const cheap = result.find((r) => r.offerId === 'cheap_bad')!;
    const mid = result.find((r) => r.offerId === 'mid_good')!;
    expect(mid.score).toBeGreaterThan(cheap.score);
  });

  it('возвращает результат, отсортированный по убыванию score', () => {
    const result = service.compare([
      offer('a', 40000, 3),
      offer('b', 38000, 5),
      offer('c', 39000, 4),
    ]);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('пустой список даёт пустой результат', () => {
    expect(service.compare([])).toEqual([]);
  });
});
