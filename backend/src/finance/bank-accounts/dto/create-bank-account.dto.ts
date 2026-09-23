import { IsString, IsOptional, IsBoolean, IsEnum, IsIn, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'The Film Makers FZ LLC' })
  @IsString()
  accountName: string;

  @ApiProperty({ example: 'Emirates NBD' })
  @IsString()
  bankName: string;

  @ApiPropertyOptional({ example: 'Dubai Main Branch' })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  accountNumber: string;

  @ApiPropertyOptional({ example: 'AE070331234567890123456' })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional({ example: 'EBILAEAD' })
  @IsOptional()
  @IsString()
  swiftCode?: string;

  @ApiPropertyOptional({ enum: Currency, default: 'AED' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrPaymentData?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultInvoice?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultQuotation?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefaultReceiving?: boolean;

  /** COMPANY = the company's own account; OWNER = the GM's personal account, used
   *  only to record payments he made himself. Owner accounts are never offered on
   *  invoices or quotations. */
  @ApiPropertyOptional({ enum: ['COMPANY', 'OWNER'], default: 'COMPANY' })
  @IsOptional()
  @IsIn(['COMPANY', 'OWNER'])
  ownership?: 'COMPANY' | 'OWNER';

  /** Last 4 digits of the card on this account, for matching card slips. Never the whole number. */
  @ApiPropertyOptional({ example: '3825' })
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Card last 4 must be exactly 4 digits.' })
  cardLast4?: string;
}
