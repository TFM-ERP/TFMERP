import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A union/statutory rate rule (mirrors the fringe-engine RuleLike shape). The service
 * field-maps via rateRuleData; dates may arrive as '' from the form, and base/capPeriod/
 * caps as null, so those stay lenient. Internal callers add approvedById/approvedAt and
 * bypass this DTO (it only governs the HTTP boundary).
 */
export class CreateRateRuleDto {
  @ApiProperty() @IsString() agreementId: string;
  @ApiProperty() @IsString() label: string;
  @ApiProperty({ example: 'PENSION' }) @IsString() rateType: string;
  @ApiProperty({ example: 'PERCENT' }) @IsString() calcMethod: string;
  @ApiProperty({ example: 0.205 }) @IsNumber() value: number;

  @ApiPropertyOptional() @IsOptional() @IsString() base?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() capPeriod?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() capAmount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() floorAmount?: number | null;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() tiers?: any[] | null;

  @ApiPropertyOptional({ default: 'USD' }) @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() glAccountCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() classificationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() effectiveDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() expirationDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEstimate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
