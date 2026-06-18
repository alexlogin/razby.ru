'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ROLE_LABELS_RU, STAFF_ROLES } from '@razby/shared';

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isStaff = user ? STAFF_ROLES.includes(user.role) : false;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white font-black">
            R
          </span>
          <span className="text-lg font-extrabold tracking-tight">Razby.ru</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link href="/assistant" className="px-3 py-2 font-medium text-gray-700 hover:text-brand-600">
            ИИ-агент
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="hidden px-3 py-2 font-medium text-gray-700 hover:text-brand-600 sm:block">
                Мои проекты
              </Link>
              {isStaff && (
                <Link href="/admin" className="hidden px-3 py-2 font-medium text-gray-700 hover:text-brand-600 sm:block">
                  Админка
                </Link>
              )}
              <span className="hidden text-xs text-gray-500 sm:block">
                {user.firstName ?? user.email} · {ROLE_LABELS_RU[user.role]}
              </span>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="btn-ghost px-3 py-2 text-sm"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 font-medium text-gray-700 hover:text-brand-600">
                Вход
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2 text-sm">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
