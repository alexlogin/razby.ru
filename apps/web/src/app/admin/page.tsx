'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rub } from '@/lib/format';
import { ROLE_LABELS_RU, STAFF_ROLES, type AiSettingsView } from '@razby/shared';

interface Analytics {
  usersByRole: { role: string; count: number }[];
  projectsTotal: number;
  projectsByStatus: { status: string; count: number }[];
  offersTotal: number;
  estimatedVolume: number;
  openDisputes: number;
  providersPendingVerification: number;
}
interface Provider {
  id: string;
  companyName: string | null;
  verificationStatus: string;
  ratingAvg: string;
  user: { id: string; email: string; role: string };
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    if (!loading && (!user || !STAFF_ROLES.includes(user.role))) router.push('/dashboard');
  }, [loading, user, router]);

  function load() {
    api<Analytics>('/admin/analytics').then(setStats).catch(() => {});
    api<Provider[]>('/admin/providers').then(setProviders).catch(() => {});
  }
  useEffect(load, []);

  async function verify(userId: string, approve: boolean) {
    await api(`/admin/providers/${userId}/verify`, { method: 'POST', body: { approve } });
    load();
  }

  if (!user || !stats) return <p className="text-gray-500">Загрузка…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Административная панель</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: 'Проектов', v: stats.projectsTotal },
          { l: 'Предложений', v: stats.offersTotal },
          { l: 'Объём смет', v: rub(stats.estimatedVolume) },
          { l: 'Открытых споров', v: stats.openDisputes },
        ].map((k) => (
          <div key={k.l} className="card p-4">
            <p className="text-xs text-gray-500">{k.l}</p>
            <p className="mt-1 text-xl font-extrabold">{k.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Пользователи по ролям</h2>
          <div className="space-y-1 text-sm">
            {stats.usersByRole.map((u) => (
              <div key={u.role} className="flex justify-between">
                <span className="text-gray-600">{ROLE_LABELS_RU[u.role as keyof typeof ROLE_LABELS_RU] ?? u.role}</span>
                <span className="font-semibold">{u.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">
            Проверка исполнителей
            {stats.providersPendingVerification > 0 && (
              <span className="badge ml-2 bg-amber-100 text-amber-700">{stats.providersPendingVerification} ждут</span>
            )}
          </h2>
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-2 text-sm">
                <div>
                  <p className="font-medium">{p.companyName ?? p.user.email}</p>
                  <p className="text-xs text-gray-500">
                    {ROLE_LABELS_RU[p.user.role as keyof typeof ROLE_LABELS_RU]} · ★ {p.ratingAvg} ·{' '}
                    <span className={p.verificationStatus === 'VERIFIED' ? 'text-green-600' : 'text-amber-600'}>
                      {p.verificationStatus}
                    </span>
                  </p>
                </div>
                {p.verificationStatus !== 'VERIFIED' && (
                  <div className="flex gap-1">
                    <button className="btn-primary px-2 py-1 text-xs" onClick={() => verify(p.user.id, true)}>
                      Одобрить
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => verify(p.user.id, false)}>
                      Откл.
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AiSettingsCard />
    </div>
  );
}

function AiSettingsCard() {
  const [data, setData] = useState<AiSettingsView | null>(null);
  const [driver, setDriver] = useState<'heuristic' | 'openrouter'>('heuristic');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api<AiSettingsView>('/admin/ai-settings')
      .then((d) => {
        setData(d);
        setDriver(d.driver);
        setModel(d.model);
      })
      .catch(() => {});
  }
  useEffect(load, []);

  async function save() {
    setStatus('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = { driver, model };
      if (apiKey) body.apiKey = apiKey; // пустое поле — ключ не меняем
      const updated = await api<AiSettingsView>('/admin/ai-settings', { method: 'PUT', body });
      setData(updated);
      setApiKey('');
      setStatus('Сохранено');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">ИИ-агент</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          источник: {data.source === 'db' ? 'админка' : 'переменные окружения'}
        </span>
      </div>
      <p className="text-sm text-gray-500">
        Режим понимания запроса. Для бесплатных моделей подойдёт ключ{' '}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-brand-600">
          OpenRouter
        </a>{' '}
        и модель с суффиксом <code>:free</code>.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Режим</label>
          <select
            className="input"
            value={driver}
            onChange={(e) => setDriver(e.target.value as 'heuristic' | 'openrouter')}
          >
            <option value="heuristic">Эвристика (офлайн, без затрат)</option>
            <option value="openrouter">OpenRouter (бесплатные модели)</option>
          </select>
        </div>
        <div>
          <label className="label">Модель</label>
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="meta-llama/llama-3.3-70b-instruct:free"
          />
        </div>
      </div>

      <div>
        <label className="label">
          API-ключ {data.hasApiKey && <span className="text-gray-400">(сейчас: {data.keyMask})</span>}
        </label>
        <input
          className="input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={data.hasApiKey ? 'Оставьте пустым, чтобы не менять' : 'sk-or-...'}
          autoComplete="off"
        />
        {driver === 'openrouter' && !data.hasApiKey && !apiKey && (
          <p className="mt-1 text-xs text-amber-600">
            Без ключа OpenRouter будет работать эвристика (цены только для сценариев из БД).
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
        {status && <span className="text-sm text-gray-500">{status}</span>}
      </div>
    </div>
  );
}
