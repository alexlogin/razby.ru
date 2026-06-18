'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rub } from '@/lib/format';
import { PROVIDER_ROLES } from '@razby/shared';

interface Tender {
  id: string;
  title: string;
  type: string;
  project: { title: string; address?: string | null };
  offers: { id: string; price: string }[];
}

export default function TendersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState({ price: '', durationDays: '', warrantyMonths: '12', comment: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!loading && (!user || !PROVIDER_ROLES.includes(user.role))) router.push('/dashboard');
  }, [loading, user, router]);

  function load() {
    api<Tender[]>('/tenders/open').then(setTenders).catch(() => setTenders([]));
  }
  useEffect(load, []);

  async function submit(tenderId: string) {
    setMsg('');
    try {
      await api(`/tenders/${tenderId}/offers`, {
        method: 'POST',
        body: {
          price: Number(form.price),
          durationDays: form.durationDays ? Number(form.durationDays) : undefined,
          warrantyMonths: Number(form.warrantyMonths),
          comment: form.comment,
          availableDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      });
      setMsg('Предложение отправлено');
      setActive(null);
      setForm({ price: '', durationDays: '', warrantyMonths: '12', comment: '' });
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Открытые тендеры</h1>
      {msg && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}
      {tenders.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">Сейчас нет открытых тендеров по вашему профилю.</div>
      ) : (
        tenders.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{t.title}</p>
                <p className="text-sm text-gray-500">
                  {t.project.title} {t.project.address ? `· ${t.project.address}` : ''}
                </p>
                {t.offers.length > 0 && (
                  <p className="mt-1 text-xs text-green-600">Вы предложили {rub(t.offers[0].price)}</p>
                )}
              </div>
              <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setActive(active === t.id ? null : t.id)}>
                {t.offers.length ? 'Изменить' : 'Предложить'}
              </button>
            </div>
            {active === t.id && (
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <input className="input" placeholder="Цена, ₽" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                <input className="input" placeholder="Срок, дн" type="number" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
                <input className="input" placeholder="Гарантия, мес" type="number" value={form.warrantyMonths} onChange={(e) => setForm({ ...form, warrantyMonths: e.target.value })} />
                <button className="btn-primary" onClick={() => submit(t.id)} disabled={!form.price}>
                  Отправить
                </button>
                <input className="input sm:col-span-4" placeholder="Комментарий" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
