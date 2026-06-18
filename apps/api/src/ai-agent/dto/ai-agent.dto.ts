import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AnalyzeRequestDto {
  @ApiProperty({
    description: 'Свободный запрос пользователя, например «Монтаж погреба 3x2x2»',
    example: 'Монтаж погреба 3 на 2 на 2',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  query!: string;

  @ApiPropertyOptional({ description: 'Код региона для цен (напр. RU-MOS)', example: 'RU-MOS' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  regionCode?: string;
}
