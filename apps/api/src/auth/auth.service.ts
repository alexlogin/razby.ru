import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomInt } from 'crypto';
import { Role, type AuthResponse, type AuthUser } from '@razby/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';
import {
  EMAIL_PROVIDER,
  SMS_PROVIDER,
  type EmailProvider,
  type SmsProvider,
} from '../providers/messaging/messaging.provider';
import {
  ConfirmVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly CODE_TTL_MIN = 15;
  private readonly MAX_CODE_ATTEMPTS = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  private toAuthUser(user: {
    id: string;
    email: string;
    phone: string | null;
    role: Role;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    };
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    if (dto.phone) {
      const phoneTaken = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneTaken) throw new ConflictException('Этот телефон уже используется');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const role = dto.role ?? Role.CUSTOMER;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        // Профиль исполнителя для подрядчика/поставщика/перевозчика
        providerProfile:
          role === Role.CONTRACTOR || role === Role.SUPPLIER || role === Role.CARRIER
            ? { create: {} }
            : undefined,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      ...meta,
    });

    // Сразу инициируем подтверждение email
    await this.issueVerificationCode(user.id, 'EMAIL').catch((e) =>
      this.logger.warn(`Не удалось отправить код подтверждения: ${e.message}`),
    );

    const tokens = await this.tokens.issue({
      userId: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion,
      ...meta,
    });

    return { ...tokens, user: this.toAuthUser(user) };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Неверный email или пароль');
    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Неверный email или пароль');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.tokens.issue({
      userId: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion,
      ...meta,
    });

    await this.audit.log({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ...meta,
    });

    return { ...tokens, user: this.toAuthUser(user) };
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthResponse> {
    const rotated = await this.tokens.rotate(refreshToken, meta);
    if (!rotated) throw new UnauthorizedException('Сессия истекла, войдите заново');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: rotated.payload.sub },
    });
    return { ...rotated.tokens, user: this.toAuthUser(user) };
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (refreshToken) await this.tokens.revokeToken(refreshToken);
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Не раскрываем наличие аккаунта
    if (user) {
      const code = randomInt(100000, 999999).toString();
      await this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          channel: 'RESET',
          codeHash: this.hashCode(code),
          target: user.email,
          expiresAt: new Date(Date.now() + this.CODE_TTL_MIN * 60_000),
        },
      });
      await this.email.send({
        to: user.email,
        subject: 'Восстановление пароля — Razby.ru',
        text: `Ваш код для сброса пароля: ${code}. Действует ${this.CODE_TTL_MIN} минут.`,
        html: `<p>Ваш код для сброса пароля: <b>${code}</b></p>`,
      });
    }
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean }> {
    const codeHash = this.hashCode(dto.token);
    const record = await this.prisma.verificationToken.findFirst({
      where: { channel: 'RESET', codeHash, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Код недействителен или истёк');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        // tokenVersion++ инвалидирует все ранее выпущенные access-токены
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    await this.tokens.revokeAllForUser(record.userId);
    await this.audit.log({
      actorId: record.userId,
      action: 'auth.password_reset',
      entityType: 'User',
      entityId: record.userId,
    });
    return { success: true };
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /** Генерация и отправка кода подтверждения по выбранному каналу. */
  async issueVerificationCode(userId: string, channel: 'EMAIL' | 'PHONE'): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const target = channel === 'EMAIL' ? user.email : user.phone;
    if (!target) throw new BadRequestException('Не указан адрес для подтверждения');

    const code = randomInt(100000, 999999).toString();
    await this.prisma.verificationToken.create({
      data: {
        userId,
        channel,
        codeHash: this.hashCode(code),
        target,
        expiresAt: new Date(Date.now() + this.CODE_TTL_MIN * 60_000),
      },
    });

    if (channel === 'EMAIL') {
      await this.email.send({
        to: target,
        subject: 'Подтверждение email — Razby.ru',
        text: `Код подтверждения: ${code}`,
        html: `<p>Код подтверждения: <b>${code}</b></p>`,
      });
    } else {
      await this.sms.send(target, `Razby.ru: код подтверждения ${code}`);
    }
    return { sent: true };
  }

  async confirmVerification(userId: string, dto: ConfirmVerificationDto): Promise<{ verified: boolean }> {
    const record = await this.prisma.verificationToken.findFirst({
      where: { userId, channel: dto.channel, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Код не найден или истёк, запросите новый');
    }
    if (record.attempts >= this.MAX_CODE_ATTEMPTS) {
      throw new BadRequestException('Превышено число попыток, запросите новый код');
    }

    if (record.codeHash !== this.hashCode(dto.code)) {
      await this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Неверный код');
    }

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data:
          dto.channel === 'EMAIL'
            ? { emailVerified: true }
            : { phoneVerified: true },
      }),
    ]);
    return { verified: true };
  }
}
