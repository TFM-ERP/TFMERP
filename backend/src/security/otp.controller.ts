import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security/otp')
export class OtpController {
  constructor(private service: OtpService) {}

  // Request a code emailed to the data subject for revealing specific masked fields.
  @Post('request') request(@Body() b: any, @Req() req: any) { return this.service.request(b, req.user?.id); }
  // Verify the code → returns the requested clear field values.
  @Post('verify') verify(@Body() b: any) { return this.service.verify(b?.challengeId, b?.code); }
}
