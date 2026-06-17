/**
 * Роли пользователей платформы Razby.ru.
 * Значения должны совпадать с enum Role в prisma/schema.prisma.
 */
export const Role = {
  CUSTOMER: 'CUSTOMER', // Заказчик
  CONTRACTOR: 'CONTRACTOR', // Подрядчик
  SUPPLIER: 'SUPPLIER', // Поставщик
  CARRIER: 'CARRIER', // Перевозчик
  COORDINATOR: 'COORDINATOR', // Координатор
  ADMIN: 'ADMIN', // Администратор
  SUPERADMIN: 'SUPERADMIN', // Суперадминистратор
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

export const ROLE_LABELS_RU: Record<Role, string> = {
  CUSTOMER: 'Заказчик',
  CONTRACTOR: 'Подрядчик',
  SUPPLIER: 'Поставщик',
  CARRIER: 'Перевозчик',
  COORDINATOR: 'Координатор',
  ADMIN: 'Администратор',
  SUPERADMIN: 'Суперадминистратор',
};

/** Роли, имеющие доступ к административной панели. */
export const STAFF_ROLES: Role[] = [Role.COORDINATOR, Role.ADMIN, Role.SUPERADMIN];

/** Роли исполнителей, которые подают предложения. */
export const PROVIDER_ROLES: Role[] = [Role.CONTRACTOR, Role.SUPPLIER, Role.CARRIER];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}
