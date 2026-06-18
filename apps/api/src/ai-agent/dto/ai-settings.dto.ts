import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAiSettingsDto {
  @ApiPropertyOptional({ enum: ['heuristic', 'openrouter'], description: 'Режим понимания запроса' })
  @IsOptional()
  @IsIn(['heuristic', 'openrouter'])
  driver?: 'heuristic' | 'openrouter';

  @ApiPropertyOptional({ description: 'Модель OpenRouter', example: 'meta-llama/llama-3.3-70b-instruct:free' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional({ description: 'Базовый URL API (по умолчанию OpenRouter)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  baseUrl?: string;

  @ApiPropertyOptional({
    description: 'API-ключ. Пустая строка — очистить, отсутствие поля — оставить как есть.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiKey?: string;
}
