import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Погреб на даче в Подмосковье' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'slug шаблона проекта' })
  @IsOptional()
  @IsString()
  templateSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'code региона' })
  @IsOptional()
  @IsString()
  regionCode?: string;
}

export class AnswerItemDto {
  @ApiProperty()
  @IsString()
  questionCode!: string;

  @ApiProperty({ description: 'Значение ответа (любой JSON-тип)' })
  value!: unknown;
}

export class SaveAnswersDto {
  @ApiProperty({ type: [AnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers!: AnswerItemDto[];
}
