'use client';

import { Assistant } from '@/components/assistant';

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">Разберём вашу стройку на этапы</h1>
        <p className="mt-2 text-gray-500">
          Опишите задачу — агент подберёт этапы и сравнит цену «по этапам» и «под ключ». Без
          регистрации.
        </p>
      </div>
      <Assistant />
    </div>
  );
}
