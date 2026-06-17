'use client';

interface QuestionOption {
  value: string;
  label: string;
}
export interface Question {
  code: string;
  label: string;
  hint?: string | null;
  type: string;
  required: boolean;
  unit?: string | null;
  options?: QuestionOption[];
  conditionalOn?: { questionCode: string; op: string; value: unknown } | null;
  validation?: { min?: number; max?: number } | null;
}

export function QuestionField({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const common = 'input';
  switch (q.type) {
    case 'NUMBER':
    case 'VOLUME':
    case 'DISTANCE':
      return (
        <input
          type="number"
          step="any"
          className={common}
          value={(value as number) ?? ''}
          min={q.validation?.min}
          max={q.validation?.max}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={q.unit ? `в ${q.unit}` : undefined}
        />
      );
    case 'BOOLEAN':
      return (
        <div className="flex gap-2">
          {[
            { v: true, l: 'Да' },
            { v: false, l: 'Нет' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={`btn px-5 py-2.5 ${value === o.v ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}
            >
              {o.l}
            </button>
          ))}
        </div>
      );
    case 'SELECT':
      return (
        <select className={common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— выберите —</option>
          {q.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'MULTISELECT':
      return (
        <div className="flex flex-wrap gap-2">
          {q.options?.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const active = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(active ? arr.filter((x) => x !== o.value) : [...arr, o.value])}
                className={`badge px-3 py-1.5 ${active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    case 'DATE':
      return <input type="date" className={common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'MAP':
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            className={common}
            placeholder="Широта"
            value={(value as { lat?: number })?.lat ?? ''}
            onChange={(e) => onChange({ ...(value as object), lat: Number(e.target.value) })}
          />
          <input
            type="number"
            step="any"
            className={common}
            placeholder="Долгота"
            value={(value as { lng?: number })?.lng ?? ''}
            onChange={(e) => onChange({ ...(value as object), lng: Number(e.target.value) })}
          />
        </div>
      );
    case 'PHOTO':
    case 'VIDEO':
    case 'FILE':
      return (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Загрузка файлов доступна в карточке проекта после расчёта.
        </p>
      );
    case 'ADDRESS':
    case 'TEXT':
    default:
      return (
        <input
          type="text"
          className={common}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

/** Проверка условия отображения вопроса. */
export function isVisible(q: Question, answers: Record<string, unknown>): boolean {
  if (!q.conditionalOn) return true;
  const { questionCode, op, value } = q.conditionalOn;
  const actual = answers[questionCode];
  switch (op) {
    case 'eq':
      return actual === value;
    case 'neq':
      return actual !== value;
    default:
      return true;
  }
}
