import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Activity, Currency, InvoiceType } from '@prisma/client';

export class InvoiceItemDto {
  @IsOptional() @IsString() kind?: string;
  @IsOptional() @IsString() serviceItemId?: string;
  @IsString() description: string;
  @IsOptional() @IsString() details?: string;
  @IsNumber() @Min(0) quantity: number;
  @IsOptional() @IsString() unit?: string;
  @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsNumber() days?: number;
  @IsOptional() @IsNumber() discountPct?: number;
  @IsOptional() @IsString() taxRateId?: string;
  @IsOptional() @IsNumber() taxAmount?: number;
}

export class CreateInvoiceDto {
  @IsString() clientId: string;
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsString() quotationId?: string;
  @IsOptional() @IsEnum(Activity) activity?: Activity;
  @IsOptional() @IsEnum(InvoiceType) invoiceType?: InvoiceType;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsEnum(Currency) currency?: Currency;
  @IsOptional() @IsNumber() discountAmount?: number;
  @IsOptional() @IsNumber() @Min(0) deductionAmount?: number;
  @IsOptional() @IsString() deductionReason?: string;
  @IsOptional() @IsString() vatDisplay?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() termsConditions?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() poNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}
