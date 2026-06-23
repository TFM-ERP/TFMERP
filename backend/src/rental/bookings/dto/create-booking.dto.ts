import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() assetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @ApiPropertyOptional({ example: 'day' }) @IsOptional() @IsString() unit?: string;
  @ApiProperty({ example: 1500 }) @IsNumber() @Min(0) unitPrice: number;
  @ApiProperty({ example: 5 }) @IsNumber() @Min(0) days: number;
  @ApiPropertyOptional({ example: 375 }) @IsOptional() @IsNumber() taxAmount?: number;
  @ApiPropertyOptional({ description: 'Client-computed; recalculated server-side' }) @IsOptional() @IsNumber() lineTotal?: number;
}

export class CreateBookingDto {
  @ApiProperty() @IsString() clientId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() quotationId?: string;

  @ApiProperty({ example: '2026-06-24' }) @IsDateString() startDate: string;
  @ApiProperty({ example: '2026-06-30' }) @IsDateString() endDate: string;

  // Optional dates: the UI sends '' when unset, so accept any string (the service
  // converts non-empty values with `new Date(...)`).
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() deliveryAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupAddress?: string;

  @ApiPropertyOptional({ default: 'AED' }) @IsOptional() @IsString() currency?: string;

  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsNumber() @Min(0) depositAmount?: number;
  @ApiPropertyOptional({ example: 0 }) @IsOptional() @IsNumber() @Min(0) discountAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() poNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() internalNotes?: string;

  @ApiPropertyOptional({ description: 'Override the double-booking guard' })
  @IsOptional() @IsBoolean() allowConflicts?: boolean;

  @ApiPropertyOptional({ type: [BookingItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BookingItemDto)
  items?: BookingItemDto[];
}
