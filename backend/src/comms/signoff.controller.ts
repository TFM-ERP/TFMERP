import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SignoffService } from './signoff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** SYS-09 — Read-&-Sign blasts: post a gated blast, sign it, list pending + signers. */
@ApiTags('Comms · Read-&-Sign')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comms/signoffs')
export class SignoffController {
  constructor(private service: SignoffService) {}

  @Get('pending') pending(@Req() r: any) { return this.service.pending(r.user?.id); }
  @Post('channel/:channelId') create(@Param('channelId') channelId: string, @Body() b: any, @Req() r: any) { return this.service.create(channelId, b, r.user?.id); }
  @Post(':messageId/ack') ack(@Param('messageId') messageId: string, @Req() r: any) { return this.service.ack(messageId, r.user?.id); }
  @Get(':messageId/signers') signers(@Param('messageId') messageId: string) { return this.service.signers(messageId); }
}
