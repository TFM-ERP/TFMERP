import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CaptainService } from './captain.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/** SYS-12.F — Transport Captain operations console. */
@ApiTags('Logistics · Transport Captain')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logistics/captain')
export class CaptainController {
  constructor(private service: CaptainService) {}

  // Dispatch board (Kanban) + HOS roster
  @Get('board') board(@Query('projectId') projectId?: string, @Query('date') date?: string) {
    return this.service.board(projectId, date);
  }

  // The dispatch action — assign driver + vehicle (hard turnaround lockout)
  @Post('runs/:id/assign') assign(@Param('id') id: string, @Body() b: any, @Req() r: any) {
    return this.service.assign(id, b || {}, r.user?.id);
  }

  // The one-tap FSM: ACK | ARRIVE | ONBOARD | COMPLETE | CANCEL
  @Post('runs/:id/action') action(@Param('id') id: string, @Body() b: any, @Req() r: any) {
    return this.service.runAction(id, b?.action, { lat: b?.lat, lng: b?.lng }, r.user?.id, b?.eventId);
  }

  // Driver app — the logged-in driver's own runs + turnaround clock
  @Get('my-runs') myRuns(@Req() r: any, @Query('driverId') driverId?: string) { return this.service.myRuns(r.user?.id, driverId); }
  // Panic — high-priority alert to dispatch
  @Post('runs/:id/panic') panic(@Param('id') id: string, @Req() r: any) { return this.service.panic(id, r.user?.id); }
  // Cryptographic condition report → tamper-evident Document Vault
  @Post('runs/:id/condition') condition(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.conditionReport(id, b?.photos || [], r.user?.id); }

  // Hours-of-service / turnaround
  @Get('hos') hos(@Query('projectId') projectId?: string) { return this.service.hosBoard(projectId); }
  @Post('drivers/:id/wrap') wrapDriver(@Param('id') id: string) { return this.service.wrapDriver(id); }

  // Smart call-sheet sync → auto-generate pickup blocks
  @Post('sync-callsheet') sync(@Body() b: any) { return this.service.syncFromCallSheet(b?.projectId, b?.date, b?.leadMinutes ?? 60); }

  // The Garage: fleet by class + rental return countdown
  @Get('garage') garage(@Query('projectId') projectId?: string) { return this.service.garage(projectId); }

  // Recce route overlays
  @Get('routes') routes(@Query('projectId') projectId: string) { return this.service.routes(projectId); }
  @Post('routes') createRoute(@Body() b: any, @Req() r: any) { return this.service.createRoute(b, r.user?.id); }
  @Put('routes/:id') updateRoute(@Param('id') id: string, @Body() b: any) { return this.service.updateRoute(id, b); }
  @Delete('routes/:id') removeRoute(@Param('id') id: string) { return this.service.removeRoute(id); }

  // 2nd-AD "actor wrapped" → urgent car needed
  @Post('wrap-pickup') wrapPickup(@Body() b: any, @Req() r: any) { return this.service.wrapPickup(b?.projectId, b || {}, r.user?.id); }
}
