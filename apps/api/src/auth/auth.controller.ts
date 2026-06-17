import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import {
  ConfirmVerificationDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  RequestVerificationDto,
  ResetPasswordDto,
} from './dto/auth.dto';

function meta(req: Request) {
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
  };
}

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Регистрация' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Вход' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  @ApiOperation({ summary: 'Обновление токенов (ротация refresh)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  @ApiOperation({ summary: 'Выход (отзыв refresh-токена)' })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  @ApiOperation({ summary: 'Запрос восстановления пароля' })
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  @ApiOperation({ summary: 'Сброс пароля по коду' })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('verification/request')
  @ApiOperation({ summary: 'Запрос кода подтверждения email/телефона' })
  requestVerification(@CurrentUser() user: RequestUser, @Body() dto: RequestVerificationDto) {
    return this.auth.issueVerificationCode(user.sub, dto.channel);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('verification/confirm')
  @ApiOperation({ summary: 'Подтверждение кода email/телефона' })
  confirmVerification(@CurrentUser() user: RequestUser, @Body() dto: ConfirmVerificationDto) {
    return this.auth.confirmVerification(user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Текущий пользователь из токена' })
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
