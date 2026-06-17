import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '@razby/shared';

const REGISTRABLE_ROLES = [
  Role.CUSTOMER,
  Role.CONTRACTOR,
  Role.SUPPLIER,
  Role.CARRIER,
] as const;

export class RegisterDto {
  @ApiProperty({ example: 'user@razby.ru' })
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @Matches(/[A-Za-zА-Яа-я]/, { message: 'Пароль должен содержать буквы' })
  @Matches(/[0-9]/, { message: 'Пароль должен содержать цифры' })
  password!: string;

  @ApiPropertyOptional({ example: '+79991234567' })
  @IsOptional()
  @IsPhoneNumber('RU', { message: 'Некорректный номер телефона' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: REGISTRABLE_ROLES, default: Role.CUSTOMER })
  @IsOptional()
  @IsEnum(REGISTRABLE_ROLES, { message: 'Недопустимая роль для регистрации' })
  role?: (typeof REGISTRABLE_ROLES)[number];
}

export class LoginDto {
  @ApiProperty({ example: 'user@razby.ru' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@razby.ru' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RequestVerificationDto {
  @ApiProperty({ enum: ['EMAIL', 'PHONE'] })
  @IsEnum(['EMAIL', 'PHONE'])
  channel!: 'EMAIL' | 'PHONE';
}

export class ConfirmVerificationDto {
  @ApiProperty({ enum: ['EMAIL', 'PHONE'] })
  @IsEnum(['EMAIL', 'PHONE'])
  channel!: 'EMAIL' | 'PHONE';

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;
}
