import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/collections')
export class CollectionsController {
  constructor(private service: CollectionsService) {}

  @Get('aging')
  aging() { return this.service.aging(); }

  @Get('settings')
  getSettings() { return this.service.getSettings(); }

  @Put('settings')
  updateSettings(@Body() body: any) { return this.service.updateSettings(body); }

  @Get('reminder-logs/:invoiceId')
  logs(@Param('invoiceId') invoiceId: string) { return this.service.reminderLogs(invoiceId); }

  @Post('reminders/:invoiceId')
  @ApiOperation({ summary: 'Send a payment reminder for an invoice' })
  remind(@Param('invoiceId') invoiceId: string, @Body('level') level: string, @Request() req) {
    return this.service.sendReminder(invoiceId, level, req.user?.id);
  }

  @Post('scan')
  @ApiOperation({ summary: 'Run the automatic reminder scan now' })
  scan() { return this.service.scan(); }

  @Get('statement/:clientId')
  statement(@Param('clientId') clientId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.statement(clientId, from, to);
  }

  @Post('statement/:clientId/email')
  emailStatement(@Param('clientId') clientId: string, @Body() body: { from?: string; to?: string }) {
    return this.service.emailStatement(clientId, body?.from, body?.to);
  }

  @Post('test-email')
  test(@Body('to') to: string) { return this.service.testEmail(to); }
}
