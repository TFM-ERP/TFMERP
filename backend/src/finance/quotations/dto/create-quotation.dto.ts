import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Activity, Currency } from '@prisma/client';

export class QuotationItemDto {
  @ApiPropertyOptional({ example: 'ASSET' })
  @IsOptional() @IsString()
  kind?: string;

  @ApiPropertyOptional({ description: 'ServiceItem ID when kind = SERVICE' })
  @IsOptional() @IsString()
  serviceItemId?: string;

  @ApiProperty({ example: 'Star Trailer — 2 Axle with A/C' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'Full setup with generator connection' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ example: 'day' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0, description: 'Line-level discount percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPct?: number;

  @ApiPropertyOptional({ description: 'TaxRate ID from the tax_rates table' })
  @IsOptional()
  @IsString()
  taxRateId?: string;

  @ApiPropertyOptional({ example: 375, description: 'Calculated VAT amount for this line' })
  @IsOptional()
  @IsNumber()
  taxAmount?: number;
}

export class CreateQuotationDto {
  @ApiProperty({ example: 'client_cuid_here' })
  @IsString()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional({ enum: Activity, default: 'RENTAL' })
  @IsOptional()
  @IsEnum(Activity)
  activity?: Activity;

  @ApiPropertyOptional({ example: '2024-06-01' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '2024-06-30', description: 'Quotation valid until this date' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ enum: Currency, default: 'AED' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ enum: ['PERCENT', 'FIXED'] })
  @IsOptional()
  @IsString()
  discountType?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  discountValue?: number;

  @ApiPropertyOptional({ example: 500, description: 'Manual fixed deduction applied before VAT' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductionAmount?: number;

  @ApiPropertyOptional({ example: 'Goodwill discount', description: 'Reason/note for the manual deduction' })
  @IsOptional()
  @IsString()
  deductionReason?: string;

  @ApiPropertyOptional({ enum: ['INCLUDED', 'EXCLUDED', 'SEPARATE', 'HIDDEN'], default: 'SEPARATE' })
  @IsOptional()
  @IsString()
  vatDisplay?: string;

  @ApiPropertyOptional({ example: 'VAT will be finalized on invoice' })
  @IsOptional()
  @IsString()
  vatNote?: string;

  @ApiPropertyOptional({ example: 'Base Camp Package — Desert Shoot June 2024' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termsConditions?: string;

  @ApiPropertyOptional({ description: 'Internal notes — not shown on PDF' })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiProperty({ type: [QuotationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];
}
