import { Assistant } from '@/components/assistant';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <span className="badge bg-brand-100 text-brand-700">Разберём стройку на части</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          Опишите, что нужно сделать
        </h1>
        <p className="mt-2 text-gray-500">
          ИИ-агент разобьёт задачу на этапы, посчитает цену <b>по этапам</b> и <b>под ключ</b> и
          объяснит, почему по этапам дешевле. Без регистрации.
        </p>
      </div>
      <Assistant />
    </div>
  );
}
