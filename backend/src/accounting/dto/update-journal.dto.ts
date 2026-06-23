import { IsString, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JournalLineDto } from './create-journal.dto';

/** Editable journal fields. No `post` — posting is a separate state transition (PATCH :id/post). */
export class UpdateJournalDto {
  @ApiPropertyOptional({ example: '2026-06-24' }) @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memo?: string;

  @ApiPropertyOptional({ type: [JournalLineDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => JournalLineDto)
  lines?: JournalLineDto[];
}
