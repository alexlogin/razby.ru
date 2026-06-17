import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { OfferType } from '@razby/shared';

export class CreateTenderDto {
  @ApiProperty()
  @IsString()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stageId?: string;

  @ApiProperty({ enum: OfferType })
  @IsEnum(OfferType)
  type!: OfferType;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Структурированная спецификация заявки' })
  @IsOptional()
  spec?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deadline?: string;
}

export class SubmitOfferDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  availableDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  warrantyMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string;

  // подрядчик
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  workersCount?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludes?: string[];

  // поставщик
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deliveryCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  unloading?: boolean;

  // перевозчик
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capacityTons?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dimensions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  calloutCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pricePerKm?: number;
}
