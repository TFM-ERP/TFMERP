import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The service accepts either spelling of the volume/price fields, so both are allowed. */
export class CreateFuelLogDto {
  @ApiProperty() @IsString() assetId: string;
  @ApiProperty({ example: '2026-06-24' }) @IsDateString() logDate: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() litres?: number;
  @ApiPropertyOptional({ description: 'alias of litres' }) @IsOptional() @IsNumber() liters?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() costPerLitre?: number;
  @ApiPropertyOptional({ description: 'alias of costPerLitre' }) @IsOptional() @IsNumber() pricePerLiter?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() odometer?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() fuelStation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
