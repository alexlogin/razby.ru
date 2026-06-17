import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import type { AuthTokens, JwtPayload } from '@razby/shared';
import { PrismaService } from '../prisma/prisma.service';

interface IssueContext {
  userId: string;
  role: JwtPayload['role'];
  email: string;
  tokenVersion: number;
  family?: string;
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Выпуск пары access+refresh. Refresh хранится хешированным, с семейством для ротации. */
  async issue(ctx: IssueContext): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: ctx.userId,
      role: ctx.role,
      email: ctx.email,
      tv: ctx.tokenVersion,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('app.jwt.accessSecret'),
      expiresIn: this.config.get<string>('app.jwt.accessTtl'),
    });

    const family = ctx.family ?? randomUUID();
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { ...payload, family, jti },
      {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
        expiresIn: this.config.get<string>('app.jwt.refreshTtl'),
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId: ctx.userId,
        tokenHash: this.hash(refreshToken),
        family,
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Ротация refresh-токена. Если предъявлен уже отозванный токен из семейства —
   * всё семейство отзывается (защита от повторного использования).
   */
  async rotate(
    refreshToken: string,
    meta: { userAgent?: string | null; ip?: string | null },
  ): Promise<{ tokens: AuthTokens; payload: JwtPayload } | null> {
    let payload: JwtPayload & { family: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
      });
    } catch {
      return null;
    }

    const tokenHash = this.hash(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.expiresAt < new Date()) return null;

    if (stored.revokedAt) {
      // Повторное использование — компрометация. Отзываем семейство.
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // Проверяем актуальность пользователя
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.isBlocked || user.tokenVersion !== payload.tv) {
      return null;
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issue({
      userId: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion,
      family: stored.family,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    return { tokens, payload };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hash(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
