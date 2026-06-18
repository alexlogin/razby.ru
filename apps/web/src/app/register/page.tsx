'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Role, ROLE_LABELS_RU } from '@razby/shared';

const ROLES = [Role.CUSTOMER, Role.CONTRACTOR, Role.SUPPLIER, Role.CARRIER];

/** Куда вернуть пользователя после регистрации (?next=, только внутренние пути). */
function nextPath(): string {
  if (typeof window === 'undefined') return '/dashboard';
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') ? n : '/dashboard';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: Role.CUSTOMER as string });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">Регистрация</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Имя</label>
              <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div>
              <label className="label">Фамилия</label>
              <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} />
            <p className="mt-1 text-xs text-gray-400">Минимум 8 символов, буквы и цифры.</p>
          </div>
          <div>
            <label className="label">Я регистрируюсь как</label>
            <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_RU[r]}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Создаём…' : 'Создать аккаунт'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-semibold text-brand-600">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
