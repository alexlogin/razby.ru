import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ScheduleStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedEnd?: string;
}

export class AcceptStageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectStageDto {
  @ApiProperty()
  @IsString()
  reason!: string;
}

export class ChecklistItemDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}

export class UpdateChecklistDto {
  @ApiProperty({ type: [ChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItemDto[];
}
