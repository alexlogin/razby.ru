'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, API_BASE, getAccessToken } from '@/lib/api';
import { rub, STAGE_STATUS_COLOR, STAGE_STATUS_RU, PROJECT_STATUS_RU } from '@/lib/format';
import { OffersCompare } from '@/components/offers-compare';

interface Summary {
  progress: number;
  status: string;
  initialBudget: number;
  currentBudget: number;
  actualCost: number;
  potentialSavings: number;
  turnkeyEstimate: number;
  nextStage: { name: string } | null;
  delays: { name: string }[];
  materialsToOrder: { material: string; quantity: number; unit: string }[];
  stagesNeedContractor: { name: string }[];
}
interface Stage {
  id: string;
  code: string;
  name: string;
  status: string;
  estimatedCost: string;
  assigneeId: string | null;
  materials: { id: string }[];
}
interface Project {
  id: string;
  number: number;
  title: string;
  status: string;
  address?: string | null;
  stages: Stage[];
  estimates: { items: { id: string; title: string; kind: string; total: string }[] }[];
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tenders, setTenders] = useState<Record<string, string>>({});
  const [busyStage, setBusyStage] = useState('');

  const load = useCallback(() => {
    api<Project>(`/projects/${id}`).then(setProject).catch(() => {});
    api<Summary>(`/projects/${id}/summary`).then(setSummary).catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  async function createTender(stage: Stage) {
    setBusyStage(stage.id);
    try {
      const tender = await api<{ id: string }>('/tenders', {
        method: 'POST',
        body: { projectId: id, stageId: stage.id, type: 'CONTRACTOR', title: `${stage.name}` },
      });
      setTenders((t) => ({ ...t, [stage.id]: tender.id }));
    } finally {
      setBusyStage('');
    }
  }

  async function download(kind: 'pdf' | 'excel') {
    const res = await fetch(`${API_BASE}/projects/${id}/estimate/${kind}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smeta.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!project || !summary) return <p className="text-gray-500">Загрузка…</p>;
  const items = project.estimates[0]?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">
            №{project.number} · {project.title}
          </h1>
          <p className="text-sm text-gray-500">{project.address}</p>
        </div>
        <span className="badge bg-brand-100 text-brand-700">{PROJECT_STATUS_RU[project.status] ?? project.status}</span>
      </div>

      {/* Финансовый дашборд */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: 'Текущий бюджет', v: rub(summary.currentBudget), c: 'text-ink-900' },
          { l: 'Под ключ (оценка)', v: rub(summary.turnkeyEstimate), c: 'text-gray-400 line-through' },
          { l: 'Экономия', v: rub(summary.potentialSavings), c: 'text-green-600' },
          { l: 'Факт. расходы', v: rub(summary.actualCost), c: 'text-ink-900' },
        ].map((k) => (
          <div key={k.l} className="card p-4">
            <p className="text-xs text-gray-500">{k.l}</p>
            <p className={`mt-1 text-lg font-extrabold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Прогресс */}
      <div className="card p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-semibold">Прогресс проекта</span>
          <span>{summary.progress}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${summary.progress}%` }} />
        </div>
        {summary.nextStage && <p className="mt-2 text-sm text-gray-500">Следующий этап: <b>{summary.nextStage.name}</b></p>}
        {summary.delays.length > 0 && (
          <p className="mt-1 text-sm text-red-600">Задержки: {summary.delays.map((d) => d.name).join(', ')}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Этапы */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold">Этапы ({project.stages.length})</h2>
          <div className="space-y-2">
            {project.stages.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {rub(s.estimatedCost)} · {s.materials.length} материалов
                    </p>
                  </div>
                  <span className={`badge ${STAGE_STATUS_COLOR[s.status]}`}>{STAGE_STATUS_RU[s.status]}</span>
                </div>
                {(s.status === 'PENDING' || s.status === 'SCHEDULED') && !s.assigneeId && (
                  <div className="mt-3">
                    {tenders[s.id] ? (
                      <OffersCompare tenderId={tenders[s.id]} onAccepted={load} />
                    ) : (
                      <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => createTender(s)} disabled={busyStage === s.id}>
                        {busyStage === s.id ? '…' : 'Собрать предложения'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Смета */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Смета</h2>
            <div className="flex gap-1">
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => download('pdf')}>
                PDF
              </button>
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => download('excel')}>
                Excel
              </button>
            </div>
          </div>
          <div className="card divide-y divide-gray-100">
            {items.slice(0, 40).map((it) => (
              <div key={it.id} className="flex justify-between px-4 py-2 text-sm">
                <span className="truncate pr-2 text-gray-600">{it.title}</span>
                <span className="whitespace-nowrap font-medium">{rub(it.total)}</span>
              </div>
            ))}
          </div>

          {summary.materialsToOrder.length > 0 && (
            <div className="card mt-4 p-4">
              <h3 className="font-bold">Материалы к заказу</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {summary.materialsToOrder.slice(0, 10).map((m, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{m.material}</span>
                    <span className="font-medium">
                      {m.quantity} {m.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
