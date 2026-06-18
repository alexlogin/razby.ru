'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AiAnalyzeResult } from '@razby/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rub } from '@/lib/format';

interface Region {
  code: string;
  name: string;
}

const EXAMPLES = [
  'Монтаж погреба 3 на 2 на 2',
  'Забор из профлиста 30 метров на сваях',
  'Навес для машины 6 на 4',
];

function range(min: number, max: number): string {
  if (!max || min === max) return rub(min);
  return `${Number(min).toLocaleString('ru-RU')}–${rub(max)}`;
}

export function Assistant() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [regionCode, setRegionCode] = useState('RU-MOS');
  const [regions, setRegions] = useState<Region[]>([]);
  const [result, setResult] = useState<AiAnalyzeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Region[]>('/regions', { auth: false })
      .then((r) => {
        setRegions(r);
        if (r.length && !r.some((x) => x.code === 'RU-MOS')) setRegionCode(r[0].code);
      })
      .catch(() => {});
  }, []);

  async function analyze() {
    if (query.trim().length < 3) return;
    setError('');
    setBusy(true);
    setResult(null);
    try {
      const res = await api<AiAnalyzeResult>('/ai/analyze', {
        method: 'POST',
        auth: false,
        body: { query, regionCode },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обработать запрос');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Что нужно сделать?</label>
          <textarea
            className="input min-h-[88px] resize-y"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) analyze();
            }}
            placeholder="Например: Забор из профлиста 30 метров на сваях"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Регион</label>
          <select className="input" value={regionCode} onChange={(e) => setRegionCode(e.target.value)}>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" onClick={analyze} disabled={busy || query.trim().length < 3}>
          {busy ? 'Считаем расклад…' : 'Разбить на этапы и посчитать'}
        </button>
      </div>

      {result && <ResultView result={result} loggedIn={!!user} regionCode={regionCode} query={query} />}
    </div>
  );
}

function ResultView({
  result,
  loggedIn,
  regionCode,
  query,
}: {
  result: AiAnalyzeResult;
  loggedIn: boolean;
  regionCode: string;
  query: string;
}) {
  const estimated = !!result.aiEstimate;
  return (
    <div className="space-y-5">
      <div className="card space-y-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Как мы поняли запрос</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {result.matched
              ? `Точный расчёт · уверенность ${Math.round(result.confidence * 100)}%`
              : estimated
                ? 'Оценка ИИ (ориентировочно)'
                : 'Быстрый разбор'}
          </span>
        </div>
        <p className="text-sm text-gray-600">{result.summary}</p>
        {Object.keys(result.parameters).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(result.parameters).map(([k, v]) => (
              <span key={k} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 1) Точный расчёт по шаблону БД */}
      {result.matched && result.pricing && (
        <>
          <PriceCompare
            stagedLabel="По этапам (через платформу)"
            staged={rub(result.pricing.stagedTotal)}
            turnkey={rub(result.pricing.turnkeyTotal)}
            savings={
              result.pricing.savings > 0
                ? `Экономия ${rub(result.pricing.savings)} (${result.pricing.savingsPercent}%)`
                : null
            }
          />
          <div className="card p-5">
            <h3 className="mb-3 text-lg font-bold">Этапы ({result.stages.length})</h3>
            <ol className="space-y-2">
              {result.stages.map((s) => (
                <li
                  key={s.code}
                  className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {s.order}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        ~{s.estimatedDays} дн · материалы {rub(s.materialsCost)} · работы {rub(s.worksCost)}
                        {s.needsInput && ' · нужны размеры'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{rub(s.total)}</span>
                </li>
              ))}
            </ol>
          </div>
          {result.missingParameters.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Для точного расчёта материалов уточните: {result.missingParameters.map((p) => p.label).join(', ')}.
            </p>
          )}
        </>
      )}

      {/* 2) Ориентировочная оценка ИИ (нет готового сценария в БД) */}
      {estimated && result.aiEstimate && (
        <>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Готового сценария для этого запроса пока нет — цифры ниже ориентировочные (оценка ИИ),
            не точный расчёт. Порядок цен поможет понять выгоду разбивки на этапы.
          </p>
          <PriceCompare
            stagedLabel="По этапам (ориентир)"
            staged={range(result.aiEstimate.stagedMin, result.aiEstimate.stagedMax)}
            turnkey={range(result.aiEstimate.turnkeyMin, result.aiEstimate.turnkeyMax)}
            savings={
              result.aiEstimate.savingsMax > 0
                ? `Экономия ~${range(result.aiEstimate.savingsMin, result.aiEstimate.savingsMax)}`
                : null
            }
          />
          <div className="card p-5">
            <h3 className="mb-3 text-lg font-bold">Этапы ({result.aiEstimate.stages.length})</h3>
            <ol className="space-y-2">
              {result.aiEstimate.stages.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.note && <p className="text-xs text-gray-400">{s.note}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{range(s.priceMin, s.priceMax)}</span>
                </li>
              ))}
            </ol>
          </div>
          {result.aiEstimate.assumptions && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Допущения: {result.aiEstimate.assumptions}
            </p>
          )}
        </>
      )}

      {/* Почему по этапам дешевле — показываем всегда, когда есть цены */}
      {result.whyCheaper && (
        <div className="card border-l-4 border-brand-400 p-5">
          <h3 className="mb-1 text-base font-bold">Почему по этапам дешевле</h3>
          <p className="text-sm text-gray-600">{result.whyCheaper}</p>
        </div>
      )}

      {/* 3) Нет ни расчёта, ни оценки — текстовые предложения */}
      {!result.matched && !estimated && (
        <div className="card space-y-3 p-5">
          <h3 className="text-lg font-bold">Предлагаемые этапы</h3>
          {result.proposedStages.length > 0 ? (
            <ol className="ml-5 list-decimal space-y-1 text-sm text-gray-700">
              {result.proposedStages.map((s, i) => (
                <li key={i}>
                  {s.name}
                  {s.note && <span className="text-gray-400"> — {s.note}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-500">
              Опишите задачу детальнее: что делаем, размеры, материалы — и мы соберём расклад.
            </p>
          )}
        </div>
      )}

      {(result.matched || estimated) && (
        <FinalCta loggedIn={loggedIn} regionCode={regionCode} query={query} template={result.matched} />
      )}
    </div>
  );
}

function PriceCompare({
  stagedLabel,
  staged,
  turnkey,
  savings,
}: {
  stagedLabel: string;
  staged: string;
  turnkey: string;
  savings: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card border-2 border-brand-200 p-5 text-center">
          <p className="text-sm text-gray-500">{stagedLabel}</p>
          <p className="text-2xl font-extrabold text-brand-600">{staged}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-gray-500">Под ключ (ориентир)</p>
          <p className="text-2xl font-extrabold text-gray-700">{turnkey}</p>
        </div>
      </div>
      {savings && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-center font-medium text-green-800">{savings}</div>
      )}
    </div>
  );
}

function FinalCta({
  loggedIn,
  regionCode,
  query,
  template,
}: {
  loggedIn: boolean;
  regionCode: string;
  query: string;
  template: boolean;
}) {
  if (loggedIn) {
    return (
      <Link
        href={template ? '/projects/new' : '/dashboard'}
        className="btn-primary block w-full text-center"
      >
        {template ? 'Создать проект и собрать предложения' : 'Перейти в кабинет'}
      </Link>
    );
  }
  const next = `/projects/new?from=assistant&region=${encodeURIComponent(regionCode)}&q=${encodeURIComponent(query)}`;
  return (
    <div className="card space-y-3 border-2 border-brand-200 bg-brand-50/40 p-5 text-center">
      <h3 className="text-lg font-bold">Готовы запустить проект?</h3>
      <p className="text-sm text-gray-600">
        Зарегистрируйтесь, чтобы сохранить расклад, уточнить детали и собрать предложения
        подрядчиков, поставщиков и перевозчиков по каждому этапу.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="btn-primary flex-1 text-center">
          Зарегистрироваться и продолжить
        </Link>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-ghost flex-1 text-center">
          У меня есть аккаунт
        </Link>
      </div>
    </div>
  );
}
