import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FxService, BASE_CURRENCY } from './fx.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('FX')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fx')
export class FxController {
  constructor(private service: FxService) {}

  @Get('rates') async rates() { return { base: BASE_CURRENCY, rates: await this.service.listRates() }; }
  @Put('rates') save(@Body() body: any) { return this.service.upsertRates(body?.rates || body || []); }
  @Delete('rates/:currency') remove(@Param('currency') currency: string) { return this.service.removeRate(currency.toUpperCase()); }
  // Live refresh from two free sources; per currency keeps the AED-favourable quote, USD pinned to the CBUAE peg.
  @Post('refresh') refresh() { return this.service.refreshOnline(); }
}
