import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckConflictsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @IsString({ each: true })
  assetIds: string[];

  @ApiProperty({ example: '2026-06-24' }) @IsDateString() startDate: string;
  @ApiProperty({ example: '2026-06-30' }) @IsDateString() endDate: string;

  @ApiPropertyOptional({ description: 'Exclude this booking from the conflict scan (when editing)' })
  @IsOptional() @IsString() excludeBookingId?: string;
}
