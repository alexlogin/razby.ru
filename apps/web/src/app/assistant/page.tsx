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

const EXAMPLES = ['Монтаж погреба 3 на 2 на 2', 'Установка пластикового погреба 8 м³', 'Погреб длина 4 ширина 2.5 высота 2'];

export default function AssistantPage() {
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Разберём вашу стройку на этапы</h1>
        <p className="mt-2 text-gray-500">
          Опишите задачу своими словами — ИИ-агент подберёт этапы и посчитает две цены:
          <b> по этапам</b> (через платформу) и <b> под ключ</b>. Без регистрации.
        </p>
      </div>

      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Что нужно сделать?</label>
          <textarea
            className="input min-h-[96px] resize-y"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например: Монтаж погреба 3 на 2 на 2"
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
          {busy ? 'Анализируем…' : 'Разобрать на этапы'}
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
  return (
    <div className="space-y-5">
      <div className="card space-y-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Как мы поняли запрос</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {result.source === 'llm' ? 'ИИ-модель' : 'Быстрый разбор'}
            {result.matched && ` · уверенность ${Math.round(result.confidence * 100)}%`}
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

      {result.matched && result.pricing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card border-2 border-brand-200 p-5 text-center">
              <p className="text-sm text-gray-500">По этапам (через платформу)</p>
              <p className="text-3xl font-extrabold text-brand-600">{rub(result.pricing.stagedTotal)}</p>
              <p className="text-xs text-gray-400">материалы + работы + комиссия</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-gray-500">Под ключ (ориентир)</p>
              <p className="text-3xl font-extrabold text-gray-700">{rub(result.pricing.turnkeyTotal)}</p>
              <p className="text-xs text-gray-400">средняя цена подрядчика</p>
            </div>
          </div>

          {result.pricing.savings > 0 && (
            <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-green-800">
              Экономия при работе по этапам: <b>{rub(result.pricing.savings)}</b> (
              {result.pricing.savingsPercent}%)
            </div>
          )}

          <div className="card p-5">
            <h3 className="mb-3 text-lg font-bold">Этапы ({result.stages.length})</h3>
            <ol className="space-y-2">
              {result.stages.map((s) => (
                <li key={s.code} className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 last:border-0">
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
              Для точного расчёта материалов уточните в анкете проекта:{' '}
              {result.missingParameters.map((p) => p.label).join(', ')}.
            </p>
          )}

          <FinalCta loggedIn={loggedIn} regionCode={regionCode} query={query} />
        </>
      ) : (
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
              Пока не удалось подобрать готовый сценарий. Опишите задачу детальнее (что монтируем,
              размеры, материалы).
            </p>
          )}
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Точный расчёт по формулам доступен для готовых сценариев. Мы добавляем новые — следите
            за обновлениями.
          </p>
        </div>
      )}
    </div>
  );
}

function FinalCta({
  loggedIn,
  regionCode,
  query,
}: {
  loggedIn: boolean;
  regionCode: string;
  query: string;
}) {
  if (loggedIn) {
    return (
      <Link href="/projects/new" className="btn-primary block w-full text-center">
        Создать проект и собрать предложения
      </Link>
    );
  }
  // Без регистрации считаем смету; регистрацию предлагаем только на финальном действии.
  const next = `/projects/new?from=assistant&region=${encodeURIComponent(regionCode)}&q=${encodeURIComponent(query)}`;
  return (
    <div className="card space-y-3 border-2 border-brand-200 bg-brand-50/40 p-5 text-center">
      <h3 className="text-lg font-bold">Готовы запустить проект?</h3>
      <p className="text-sm text-gray-600">
        Зарегистрируйтесь, чтобы сохранить расчёт, заполнить анкету для точной сметы и собрать
        предложения подрядчиков, поставщиков и перевозчиков.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="btn-primary flex-1 text-center"
        >
          Зарегистрироваться и продолжить
        </Link>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-ghost flex-1 text-center">
          У меня есть аккаунт
        </Link>
      </div>
    </div>
  );
}
