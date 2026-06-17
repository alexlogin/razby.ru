import type { Role } from './roles.js';

/** Полезная нагрузка access-токена. */
export interface JwtPayload {
  sub: string; // userId
  role: Role;
  email: string;
  tv: number; // tokenVersion — для инвалидации
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
