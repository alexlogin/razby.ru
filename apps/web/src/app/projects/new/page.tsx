'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rub } from '@/lib/format';
import { QuestionField, isVisible, type Question } from '@/components/question-field';

interface Template {
  id: string;
  slug: string;
  name: string;
  description?: string;
  questionnaire?: { questions: Question[] };
}
interface Region {
  code: string;
  name: string;
}
interface EstimateResult {
  total: number;
  materialsCost: number;
  worksCost: number;
}

const TEMPLATE_SLUG = 'plastic-cellar';

export default function NewProjectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [template, setTemplate] = useState<Template | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [step, setStep] = useState(0);
  const [basics, setBasics] = useState({ title: 'Монтаж погреба', address: '', regionCode: 'RU-MOS' });
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [projectId, setProjectId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    api<Template>(`/templates/${TEMPLATE_SLUG}`).then(setTemplate).catch(() => {});
    api<Region[]>('/regions').then(setRegions).catch(() => {});
  }, []);

  const questions = useMemo(
    () => (template?.questionnaire?.questions ?? []).filter((q) => isVisible(q, answers)),
    [template, answers],
  );

  async function startCalculation() {
    setError('');
    setBusy(true);
    try {
      const project = await api<{ id: string }>('/projects', {
        method: 'POST',
        body: {
          title: basics.title,
          templateSlug: TEMPLATE_SLUG,
          regionCode: basics.regionCode,
          address: basics.address,
        },
      });
      setProjectId(project.id);
      await api(`/projects/${project.id}/answers`, {
        method: 'POST',
        body: { answers: Object.entries(answers).map(([questionCode, value]) => ({ questionCode, value })) },
      });
      const result = await api<EstimateResult>(`/projects/${project.id}/calculate`, { method: 'POST' });
      setEstimate(result);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка расчёта');
    } finally {
      setBusy(false);
    }
  }

  if (!user || !template) return <p className="text-gray-500">Загрузка…</p>;

  const steps = ['Объект', 'Анкета', 'Смета'];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                i <= step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm ${i === step ? 'font-semibold' : 'text-gray-500'}`}>{s}</span>
            {i < steps.length - 1 && <div className="h-0.5 flex-1 bg-gray-200" />}
          </div>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {step === 0 && (
        <div className="card space-y-4 p-6">
          <h2 className="text-xl font-bold">{template.name}</h2>
          <p className="text-sm text-gray-500">{template.description}</p>
          <div>
            <label className="label">Название проекта</label>
            <input className="input" value={basics.title} onChange={(e) => setBasics({ ...basics, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Адрес участка</label>
            <input className="input" value={basics.address} onChange={(e) => setBasics({ ...basics, address: e.target.value })} placeholder="Регион, населённый пункт" />
          </div>
          <div>
            <label className="label">Регион</label>
            <select className="input" value={basics.regionCode} onChange={(e) => setBasics({ ...basics, regionCode: e.target.value })}>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" onClick={() => setStep(1)} disabled={!basics.title}>
            Далее
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card space-y-5 p-6">
          <h2 className="text-xl font-bold">Анкета объекта</h2>
          {questions.map((q) => (
            <div key={q.code}>
              <label className="label">
                {q.label}
                {q.required && <span className="text-brand-600"> *</span>}
                {q.unit && <span className="text-gray-400"> ({q.unit})</span>}
              </label>
              {q.hint && <p className="mb-1 text-xs text-gray-400">{q.hint}</p>}
              <QuestionField q={q} value={answers[q.code]} onChange={(v) => setAnswers((a) => ({ ...a, [q.code]: v }))} />
            </div>
          ))}
          <div className="flex gap-3">
            <button className="btn-ghost" onClick={() => setStep(0)}>
              Назад
            </button>
            <button className="btn-primary flex-1" onClick={startCalculation} disabled={busy}>
              {busy ? 'Считаем…' : 'Рассчитать смету'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && estimate && projectId && (
        <div className="card space-y-4 p-6 text-center">
          <h2 className="text-xl font-bold">Смета рассчитана</h2>
          <p className="text-4xl font-extrabold text-brand-600">{rub(estimate.total)}</p>
          <div className="grid grid-cols-2 gap-3 text-left text-sm">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-500">Материалы</p>
              <p className="font-bold">{rub(estimate.materialsCost)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-500">Работы (оценка)</p>
              <p className="font-bold">{rub(estimate.worksCost)}</p>
            </div>
          </div>
          <Link href={`/projects/${projectId}`} className="btn-primary w-full">
            Открыть проект
          </Link>
        </div>
      )}
    </div>
  );
}
