import { SetMetadata } from '@nestjs/common';
import type { Role } from '@razby/shared';

export const ROLES_KEY = 'roles';
/** Ограничивает маршрут перечисленными ролями. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
