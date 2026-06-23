import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JournalLineDto {
  @ApiProperty() @IsString() accountId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty({ example: 100 }) @IsNumber() debit: number;
  @ApiProperty({ example: 0 }) @IsNumber() credit: number;
}

export class CreateJournalDto {
  @ApiProperty({ example: '2026-06-24' }) @IsDateString() date: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memo?: string;

  @ApiPropertyOptional({ description: 'Post immediately instead of saving as DRAFT' })
  @IsOptional() @IsBoolean() post?: boolean;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}
