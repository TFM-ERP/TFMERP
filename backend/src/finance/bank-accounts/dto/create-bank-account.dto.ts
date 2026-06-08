import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
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
}
