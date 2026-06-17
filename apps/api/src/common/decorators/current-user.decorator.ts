import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@razby/shared';

export interface RequestUser extends JwtPayload {}

/** Извлекает пользователя из запроса (положен JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    return data ? user?.[data] : user;
  },
);
