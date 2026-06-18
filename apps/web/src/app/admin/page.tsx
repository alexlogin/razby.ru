'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rub } from '@/lib/format';
import { ROLE_LABELS_RU, STAFF_ROLES } from '@razby/shared';

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
    </div>
  );
}
