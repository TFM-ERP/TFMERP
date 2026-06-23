import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Ledger bank account. The service spreads this into ledgerBankAccount.create. */
export class CreateBankAccountDto {
  @ApiProperty({ example: 'Main Operating' }) @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accountNumber?: string;
  @ApiProperty({ description: 'GL account this bank maps to' }) @IsString() glAccountId: string;
}
