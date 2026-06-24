import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ChatReceiptService } from './chat-receipt.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/** Chat-to-ledger receipt bot — intake, then lead approve/reject. */
@ApiTags('Production · Chat receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production/costing/chat-receipt')
export class ChatReceiptController {
  constructor(private service: ChatReceiptService) {}

  @Post() intake(@Body() b: any, @Req() r: any) { return this.service.intake(b, r.user?.id); }
  @Post(':txnId/approve') approve(@Param('txnId') id: string, @Req() r: any) { return this.service.approve(id, r.user?.id); }
  @Post(':txnId/reject') reject(@Param('txnId') id: string, @Req() r: any) { return this.service.reject(id, r.user?.id); }
}
