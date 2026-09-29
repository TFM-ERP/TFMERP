import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@ApiTags('Rental')
@ApiBearerAuth()
/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could schedule maintenance
 * against an asset, edit the log, or start, complete or cancel it. The guard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so each write decorator
 * replaces the floor for its own route.
 *
 * FOUR OF THE FIVE WRITES MOVE THE ASSET, not just the log — read from maintenance.service.ts:
 *   create   -> asset.status = IN_MAINTENANCE, but ONLY when scheduledDate is today (:86-93).
 *   start    -> transaction: log IN_PROGRESS + asset IN_MAINTENANCE (:129-141).
 *   complete -> transaction: log COMPLETED  + asset AVAILABLE      (:148-169).
 *   cancel   -> transaction: log CANCELLED, and asset AVAILABLE only if it was IN_MAINTENANCE.
 * That is why these are not merely log edits: they take a unit out of the fleet and put it back.
 *
 * ASSET.STATUS HAS THREE DOORS, swept before this level was described, and all three now sit at
 * rentals:2:
 *   · PATCH /rental/assets/:id/status (de65faa), also reached from the Workflow board via statusApi;
 *   · PUT /rental/assets/:id — sanitize() keeps `status` in its allowlist (assets.service.ts:100),
 *     so the ordinary asset edit writes it too. That was not obvious and is recorded here;
 *   · the four sites above.
 * maintenanceLog itself has no second writer.
 *
 * A GAP THAT IS NOT A PERMISSION GAP. update() assigns `status` straight through (:102), so a PUT
 * can set a log to COMPLETED or CANCELLED without the transaction that returns the asset to
 * AVAILABLE — leaving a completed job on a unit still marked IN_MAINTENANCE. Both routes are
 * rentals:2, so no level changes it; it is a service-level integrity question and is recorded, not
 * fixed here.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/maintenance')
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'List maintenance logs' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('schedule')
  @ApiOperation({ summary: 'Upcoming maintenance in next 30 days' })
  schedule(@Query('assetId') assetId?: string) { return this.service.getSchedule(assetId); }

  @Get('overdue')
  @ApiOperation({ summary: 'Overdue maintenance (past scheduled date, not completed)' })
  overdue() { return this.service.getOverdue(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Schedule maintenance for an asset' })
  create(@Body() body: CreateMaintenanceDto) { return this.service.create(body); }

  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: UpdateMaintenanceDto) { return this.service.update(id, body); }

  @Patch(':id/start')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Mark maintenance as started (SCHEDULED → IN_PROGRESS)' })
  start(@Param('id') id: string) { return this.service.start(id); }

  @Patch(':id/complete')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Mark maintenance as completed and restore asset to AVAILABLE' })
  complete(
    @Param('id') id: string,
    @Body('actualCost')     actualCost?: number,
    @Body('notes')          notes?: string,
    @Body('invoiceRef')     invoiceRef?: string,
    @Body('partsReplaced')  partsReplaced?: string,
    @Body('nextServiceDate') nextServiceDate?: string,
    @Body('downTimeDays')   downTimeDays?: number,
  ) {
    return this.service.complete(id, actualCost, notes, invoiceRef, partsReplaced, nextServiceDate, downTimeDays);
  }

  @Patch(':id/cancel')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Cancel a maintenance log' })
  cancel(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) { return this.service.cancel(id, reason); }
}
