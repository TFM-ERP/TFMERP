import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The service accepts both chargeToClient/clientLiable and photoUrls/photos spellings. */
export class CreateDamageDto {
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiProperty() @IsString() assetId: string;
  @ApiPropertyOptional({ default: 'MINOR' }) @IsOptional() @IsString() severity?: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() repairCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() chargeToClient?: boolean;
  @ApiPropertyOptional({ description: 'alias of chargeToClient' }) @IsOptional() @IsBoolean() clientLiable?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) photoUrls?: string[];
  @ApiPropertyOptional({ type: [String], description: 'alias of photoUrls' }) @IsOptional() @IsArray() @IsString({ each: true }) photos?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolvedAt?: string;
}
