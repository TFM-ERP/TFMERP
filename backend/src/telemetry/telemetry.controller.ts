import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Transport · Telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transport/telemetry')
export class TelemetryController {
  constructor(private service: TelemetryService) {}

  @Post('shift') startShift(@Body() b: any) { return this.service.startShift(b); }
  @Patch('shift/:id') setStatus(@Param('id') id: string, @Body() b: any) { return this.service.setShiftStatus(id, b.status); }
  @Get('shift/active') active(@Query('driverId') driverId: string) { return this.service.activeShiftForDriver(driverId); }
  @Post('pings') ingest(@Body() b: any) { return this.service.ingest(b?.pings || (Array.isArray(b) ? b : [])); }
  @Get('live') live(@Query('projectId') projectId?: string) { return this.service.liveMap(projectId); }
  @Get('track') track(@Query() q: any) { return this.service.track(q); }
  @Get('eta/:orderId') eta(@Param('orderId') orderId: string) { return this.service.eta(orderId); }

  // Geofenced basecamp pins + arrival check-ins
  @Get('pins/checkins') checkins(@Query('projectId') projectId: string) { return this.service.checkins(projectId); }
  @Get('pins') pins(@Query('projectId') projectId: string) { return this.service.pins(projectId); }
  @Post('pins') createPin(@Body() b: any, @Req() r: any) { return this.service.createPin(b, r.user?.id); }
  @Patch('pins/:id') updatePin(@Param('id') id: string, @Body() b: any) { return this.service.updatePin(id, b); }
  @Delete('pins/:id') removePin(@Param('id') id: string) { return this.service.removePin(id); }
}
