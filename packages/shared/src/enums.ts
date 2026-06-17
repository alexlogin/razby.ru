/**
 * Доменные перечисления. Значения синхронизированы с prisma/schema.prisma.
 */

export const ProjectStatus = {
  DRAFT: 'DRAFT', // черновик / заполнение анкеты
  CALCULATING: 'CALCULATING', // идёт расчёт сметы
  ESTIMATED: 'ESTIMATED', // смета рассчитана
  TENDERING: 'TENDERING', // сбор предложений
  IN_PROGRESS: 'IN_PROGRESS', // работы идут
  ON_HOLD: 'ON_HOLD', // приостановлен
  COMPLETED: 'COMPLETED', // завершён
  CANCELLED: 'CANCELLED', // отменён
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const StageStatus = {
  BLOCKED: 'BLOCKED', // заблокирован зависимостями
  PENDING: 'PENDING', // готов к выбору исполнителя
  SCHEDULED: 'SCHEDULED', // назначена дата
  IN_PROGRESS: 'IN_PROGRESS', // выполняется
  REVIEW: 'REVIEW', // на приёмке
  ACCEPTED: 'ACCEPTED', // принят
  REJECTED: 'REJECTED', // отклонён на приёмке
  CANCELLED: 'CANCELLED',
} as const;
export type StageStatus = (typeof StageStatus)[keyof typeof StageStatus];

export const WorkType = {
  ANALYSIS: 'ANALYSIS', // анализ / инженерные изыскания
  SURVEY: 'SURVEY', // разметка / геодезия
  EARTHWORK: 'EARTHWORK', // земляные работы
  LOGISTICS: 'LOGISTICS', // вывоз / доставка
  FOUNDATION: 'FOUNDATION', // основание
  INSTALLATION: 'INSTALLATION', // монтаж
  REINFORCEMENT: 'REINFORCEMENT', // армирование
  FORMWORK: 'FORMWORK', // опалубка
  CONCRETE: 'CONCRETE', // бетонные работы
  BACKFILL: 'BACKFILL', // обратная засыпка
  ELECTRICAL: 'ELECTRICAL', // электрика
  VENTILATION: 'VENTILATION', // вентиляция
  LANDSCAPING: 'LANDSCAPING', // планировка участка
  ACCEPTANCE: 'ACCEPTANCE', // приёмка
} as const;
export type WorkType = (typeof WorkType)[keyof typeof WorkType];

export const OfferType = {
  CONTRACTOR: 'CONTRACTOR', // предложение подрядчика (работа)
  SUPPLIER: 'SUPPLIER', // предложение поставщика (материал)
  CARRIER: 'CARRIER', // предложение перевозчика (доставка)
} as const;
export type OfferType = (typeof OfferType)[keyof typeof OfferType];

export const OfferStatus = {
  SUBMITTED: 'SUBMITTED',
  SHORTLISTED: 'SHORTLISTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type OfferStatus = (typeof OfferStatus)[keyof typeof OfferStatus];

export const TenderStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  AWARDED: 'AWARDED',
  CANCELLED: 'CANCELLED',
} as const;
export type TenderStatus = (typeof TenderStatus)[keyof typeof TenderStatus];

export const QuestionType = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN', // переключатель
  SELECT: 'SELECT', // список
  MULTISELECT: 'MULTISELECT', // множественный выбор
  DATE: 'DATE',
  ADDRESS: 'ADDRESS',
  MAP: 'MAP', // координаты на карте
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  FILE: 'FILE',
  DIMENSIONS: 'DIMENSIONS', // размеры (ДxШxВ)
  VOLUME: 'VOLUME', // объём
  DISTANCE: 'DISTANCE', // расстояние
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const DocumentType = {
  PASSPORT: 'PASSPORT',
  INN: 'INN', // ИНН
  OGRN: 'OGRN', // ОГРН/ОГРНИП
  LICENSE: 'LICENSE',
  INSURANCE: 'INSURANCE',
  CERTIFICATE: 'CERTIFICATE',
  CONTRACT: 'CONTRACT',
  ACT: 'ACT', // акт приёмки
  PHOTO_REPORT: 'PHOTO_REPORT',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const PaymentStatus = {
  PENDING: 'PENDING',
  HELD: 'HELD', // в эскроу
  RELEASED: 'RELEASED',
  REFUNDED: 'REFUNDED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const DisputeStatus = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const NotificationType = {
  SYSTEM: 'SYSTEM',
  PROJECT: 'PROJECT',
  STAGE: 'STAGE',
  OFFER: 'OFFER',
  MESSAGE: 'MESSAGE',
  PAYMENT: 'PAYMENT',
  DELIVERY: 'DELIVERY',
  DISPUTE: 'DISPUTE',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
