import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A stop on a hire's location schedule. The UI sends null for unset dates/crewCount,
 * which @IsOptional accepts (it skips validation for null/undefined).
 */
export class AddLocationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() siteName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locationUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ default: 'PLANNED' }) @IsOptional() @IsString() status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() fromDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() toDate?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsNumber() crewCount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sequence?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
}

/** Same editable fields; the UI typically patches just { status }. */
export class UpdateLocationDto extends AddLocationDto {}
