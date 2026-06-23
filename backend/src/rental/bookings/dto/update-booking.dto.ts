import { IsString, IsOptional, IsNumber, Min, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Editable booking columns only. Deliberately excludes `status` (transitions must go
 * through PATCH :id/status and the state machine), `items`, and the `allowConflicts`
 * control flag — the previous `any` body spread arbitrary fields straight into Prisma.
 */
export class UpdateBookingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quotationId?: string;

  @ApiPropertyOptional({ example: '2026-06-24' }) @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional({ example: '2026-06-30' }) @IsOptional() @IsDateString() endDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() deliveryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupAddress?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) depositAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discountAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() poNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() internalNotes?: string;
}
