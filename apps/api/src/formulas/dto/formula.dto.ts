import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class FormulaVariableDto {
  @ApiProperty({ example: 'length' })
  @IsString()
  key!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Код вопроса анкеты — источник значения' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  default?: number;
}

const ROUNDING = ['NONE', 'UP', 'DOWN', 'NEAREST'] as const;

export class CreateFormulaDto {
  @ApiProperty({ example: 'excavation_volume' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: 'Ключ: латиница в нижнем регистре, цифры, _' })
  key!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'м3' })
  @IsString()
  unit!: string;

  @ApiProperty({ example: 'length * width * depth' })
  @IsString()
  expression!: string;

  @ApiProperty({ type: [FormulaVariableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaVariableDto)
  variables!: FormulaVariableDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({ enum: ROUNDING })
  @IsOptional()
  @IsEnum(ROUNDING)
  rounding?: (typeof ROUNDING)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  roundingStep?: number;

  @ApiPropertyOptional({ description: 'Коэффициент запаса' })
  @IsOptional()
  @IsNumber()
  safetyFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  regionFactorOn?: boolean;
}

export class CreateFormulaVersionDto {
  @ApiProperty()
  @IsString()
  expression!: string;

  @ApiProperty({ type: [FormulaVariableDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaVariableDto)
  variables!: FormulaVariableDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({ enum: ROUNDING })
  @IsOptional()
  @IsEnum(ROUNDING)
  rounding?: (typeof ROUNDING)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  roundingStep?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  safetyFactor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  regionFactorOn?: boolean;

  @ApiPropertyOptional({ description: 'Дата начала действия версии' })
  @IsOptional()
  @IsString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changeNote?: string;
}

export class DryRunDto {
  @ApiProperty({ example: { length: 3, width: 2.5, depth: 2.3 } })
  @IsObject()
  inputs!: Record<string, number>;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  regionFactor?: number;
}
