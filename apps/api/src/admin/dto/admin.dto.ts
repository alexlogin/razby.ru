import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '@razby/shared';

export class SetUserRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}

export class SetUserBlockedDto {
  @ApiProperty()
  @IsBoolean()
  blocked!: boolean;
}

export class VerifyProviderDto {
  @ApiProperty()
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertRegionDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class SetRegionalPriceDto {
  @ApiProperty()
  @IsString()
  materialId!: string;

  @ApiProperty()
  @IsString()
  regionCode!: string;

  @ApiProperty()
  @IsNumber()
  price!: number;
}

export class UpsertCommissionDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  percent!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minAmount?: number;
}

export class CreatePromoDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  percentOff?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amountOff?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxRedemptions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validTo?: string;
}

export class SetSettingDto {
  @ApiProperty()
  @Allow()
  value!: unknown;
}
