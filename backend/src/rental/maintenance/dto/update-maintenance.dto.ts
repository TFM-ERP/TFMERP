import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** All editable maintenance fields (superset of create — includes status/completedDate/etc.
 *  that other flows may set). Dates are @IsString to tolerate the UI's empty-string spread. */
export class UpdateMaintenanceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() maintenanceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scheduledDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() completedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vendorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() cost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nextServiceDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() nextServiceKm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() downTimeDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() invoiceRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partsReplaced?: string;
}
