import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GlAccountType } from '@prisma/client';

/** Chart-of-accounts entry. The service spreads this straight into glAccount.create. */
export class CreateAccountDto {
  @ApiProperty({ example: '5000' }) @IsString() code: string;
  @ApiProperty({ example: 'Office Supplies' }) @IsString() name: string;
  @ApiProperty({ enum: GlAccountType, example: 'EXPENSE' }) @IsEnum(GlAccountType) type: GlAccountType;
  @ApiPropertyOptional() @IsOptional() @IsString() subtype?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isBank?: boolean;
}
