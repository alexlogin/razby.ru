import Link from 'next/link';

const STAGES = [
  'Анализ участка',
  'Земляные работы',
  'Доставка погреба',
  'Армирование',
  'Бетонирование',
  'Финальная приёмка',
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 pt-6 md:grid-cols-2">
        <div>
          <span className="badge bg-brand-100 text-brand-700">Разберём стройку на части</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Постройте дешевле,
            <br />
            заказывая работы по отдельности
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Razby.ru сам разбивает проект на этапы, считает материалы по формулам, находит
            подрядчиков, поставщиков и перевозчиков и собирает выгодную смету. Без переплаты за
            «под ключ».
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/projects/new" className="btn-primary">
              Рассчитать погреб
            </Link>
            <Link href="/register" className="btn-ghost">
              Я подрядчик / поставщик
            </Link>
          </div>
        </div>
        <div className="card p-6">
          <p className="text-sm font-semibold text-gray-500">Первый сценарий</p>
          <h2 className="mt-1 text-2xl font-bold">Монтаж пластикового погреба</h2>
          <ol className="mt-4 space-y-2">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="text-gray-700">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-gray-500">…и ещё 10 этапов с расчётом и подбором исполнителей.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { t: 'Расчёт формулами', d: 'Объёмы и количества считаются версионируемыми формулами из базы, а не «на глаз».' },
          { t: 'Сравнение предложений', d: 'Самый дешёвый, оптимальный, самый быстрый и с лучшим рейтингом — в одной таблице.' },
          { t: 'Контроль этапов', d: 'Календарь, зависимости, чек-листы, фотоотчёты и приёмка с актами.' },
        ].map((f) => (
          <div key={f.t} className="card p-6">
            <h3 className="text-lg font-bold">{f.t}</h3>
            <p className="mt-2 text-gray-600">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
