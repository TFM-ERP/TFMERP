import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@thefilmmakers.ae' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ssword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: '6-digit TOTP code (required if 2FA is enabled)', example: '123456' })
  @IsOptional()
  @IsString()
  totpCode?: string;
}
