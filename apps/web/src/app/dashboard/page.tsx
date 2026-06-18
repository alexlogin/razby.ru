'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PROJECT_STATUS_RU } from '@/lib/format';
import { PROVIDER_ROLES } from '@razby/shared';

interface ProjectRow {
  id: string;
  number: number;
  title: string;
  status: string;
  progress: number;
  address?: string | null;
  template?: { name: string } | null;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api<ProjectRow[]>('/projects')
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setBusy(false));
  }, [user]);

  if (!user) return null;
  const isProvider = PROVIDER_ROLES.includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">{isProvider ? 'Мои заказы' : 'Мои проекты'}</h1>
        {!isProvider && (
          <Link href="/projects/new" className="btn-primary">
            + Новый проект
          </Link>
        )}
      </div>

      {isProvider && (
        <Link href="/tenders" className="card flex items-center justify-between p-4 hover:bg-gray-50">
          <span className="font-semibold">Открытые тендеры для исполнителей</span>
          <span className="text-brand-600">Смотреть →</span>
        </Link>
      )}

      {busy ? (
        <p className="text-gray-500">Загрузка…</p>
      ) : projects.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          Пока нет проектов.{' '}
          {!isProvider && (
            <Link href="/projects/new" className="font-semibold text-brand-600">
              Создайте первый
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card flex items-center justify-between p-4 hover:bg-gray-50">
              <div>
                <p className="font-bold">
                  №{p.number} · {p.title}
                </p>
                <p className="text-sm text-gray-500">
                  {p.template?.name ?? 'Без шаблона'} {p.address ? `· ${p.address}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="badge bg-brand-100 text-brand-700">{PROJECT_STATUS_RU[p.status] ?? p.status}</span>
                <p className="mt-1 text-sm text-gray-500">{p.progress}%</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
