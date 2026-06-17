export function rub(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
}

export function num(value: number | string | null | undefined, digits = 2): string {
  return Number(value ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: digits });
}

export const STAGE_STATUS_RU: Record<string, string> = {
  BLOCKED: 'Заблокирован',
  PENDING: 'Готов к выбору',
  SCHEDULED: 'Запланирован',
  IN_PROGRESS: 'В работе',
  REVIEW: 'На приёмке',
  ACCEPTED: 'Принят',
  REJECTED: 'Отклонён',
  CANCELLED: 'Отменён',
};

export const PROJECT_STATUS_RU: Record<string, string> = {
  DRAFT: 'Черновик',
  CALCULATING: 'Расчёт',
  ESTIMATED: 'Смета готова',
  TENDERING: 'Сбор предложений',
  IN_PROGRESS: 'В работе',
  ON_HOLD: 'Приостановлен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export const STAGE_STATUS_COLOR: Record<string, string> = {
  BLOCKED: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-amber-100 text-amber-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  REVIEW: 'bg-purple-100 text-purple-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
