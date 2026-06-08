import { IsOptional, IsEnum, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { InvoiceStatus, Activity, InvoiceType } from '@prisma/client';

export class QueryInvoiceDto {
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsEnum(Activity) activity?: Activity;
  @IsOptional() @IsEnum(InvoiceType) invoiceType?: InvoiceType;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() overdueOnly?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}
