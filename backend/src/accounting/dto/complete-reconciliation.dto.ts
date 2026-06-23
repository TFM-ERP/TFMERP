import { IsString, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteReconciliationDto {
  @ApiProperty() @IsString() bankAccountId: string;
  @ApiProperty({ example: '2026-06-24' }) @IsDateString() statementDate: string;
  @ApiProperty({ example: 1000 }) @IsNumber() statementBalance: number;
  @ApiProperty({ example: 950 }) @IsNumber() clearedBalance: number;
}
