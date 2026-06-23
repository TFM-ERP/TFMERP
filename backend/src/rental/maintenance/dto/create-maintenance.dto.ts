import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceDto {
  @ApiProperty() @IsString() assetId: string;
  @ApiPropertyOptional({ default: 'PREVENTIVE' }) @IsOptional() @IsString() maintenanceType?: string;
  @ApiProperty({ example: '2026-06-24' }) @IsDateString() scheduledDate: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vendorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  // UI spreads an empty string when unset → @IsString, not @IsDateString.
  @ApiPropertyOptional() @IsOptional() @IsString() nextServiceDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() cost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() nextServiceKm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() downTimeDays?: number;
}
