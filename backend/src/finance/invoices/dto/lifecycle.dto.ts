import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidInvoiceDto {
  @ApiProperty({ description: 'The password you log in with. Not stored, not logged.' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ description: 'Why this invoice is being voided. Kept on the record.' })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class DeleteInvoiceDto extends VoidInvoiceDto {
  @ApiProperty({ description: 'The invoice number, typed back, to confirm.' })
  @IsString()
  @MinLength(1)
  confirmNumber!: string;
}
