import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { EmailService } from '../collections/email.service';

// SYS-13 · D10 — Email-OTP PII reveal.
@Module({
  imports: [PrismaModule],
  controllers: [OtpController],
  providers: [OtpService, EmailService],
})
export class OtpModule {}
