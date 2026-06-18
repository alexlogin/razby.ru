'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { rub } from '@/lib/format';
import { RECOMMENDATION_LABELS_RU } from '@razby/shared';

interface CompareItem {
  offer: {
    id: string;
    price: number;
    durationDays: number | null;
    warrantyMonths: number;
    provider: { id: string; name: string; rating: number; reviews: number; verified: boolean };
  };
  score: number;
  recommendations: string[];
}

const RECO_COLORS: Record<string, string> = {
  CHEAPEST: 'bg-green-100 text-green-700',
  OPTIMAL: 'bg-brand-100 text-brand-700',
  FASTEST: 'bg-blue-100 text-blue-700',
  TOP_RATED: 'bg-purple-100 text-purple-700',
};

export function OffersCompare({ tenderId, onAccepted }: { tenderId: string; onAccepted: () => void }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [accepting, setAccepting] = useState('');

  function load() {
    setBusy(true);
    api<{ items: CompareItem[] }>(`/tenders/${tenderId}/compare`)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setBusy(false));
  }
  useEffect(load, [tenderId]);

  async function accept(offerId: string) {
    setAccepting(offerId);
    try {
      await api(`/offers/${offerId}/accept`, { method: 'POST' });
      onAccepted();
    } finally {
      setAccepting('');
    }
  }

  if (busy) return <p className="text-sm text-gray-500">Загрузка предложений…</p>;
  if (items.length === 0)
    return <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">Предложений пока нет. Исполнители увидят тендер в разделе «Тендеры».</p>;

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.offer.id} className="rounded-xl border border-gray-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">
                {it.offer.provider.name || 'Исполнитель'}{' '}
                {it.offer.provider.verified && <span className="text-green-600" title="Проверен">✓</span>}
              </p>
              <p className="text-xs text-gray-500">
                ★ {it.offer.provider.rating} · {it.offer.provider.reviews} отзывов · срок {it.offer.durationDays ?? '—'} дн · гарантия {it.offer.warrantyMonths} мес
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {it.recommendations.map((r) => (
                  <span key={r} className={`badge ${RECO_COLORS[r] ?? 'bg-gray-100 text-gray-600'}`}>
                    {RECOMMENDATION_LABELS_RU[r as keyof typeof RECOMMENDATION_LABELS_RU] ?? r}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold">{rub(it.offer.price)}</p>
              <p className="text-xs text-gray-400">score {it.score}</p>
              <button className="btn-primary mt-1 px-3 py-1.5 text-sm" onClick={() => accept(it.offer.id)} disabled={!!accepting}>
                {accepting === it.offer.id ? '…' : 'Выбрать'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
