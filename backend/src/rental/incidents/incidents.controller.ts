import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { IncidentStatus } from '@prisma/client';

/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could log an incident against
 * a driver or a unit, edit it, resolve it with a cost attached, or move it through the status
 * machine. The guard resolves getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so
 * each write decorator replaces the floor for its own route.
 *
 * POST /rental/incidents IS ALSO THE DRIVER PWA'S ROUTE — app/driver/page.tsx:247 files a breakdown
 * or accident through it. rentals:2 is the ruled lock-now level for every driver-surface write, and
 * DRIVER sits at rentals:1, so no driver reaches it. That is correct today because no driver has a
 * login: all four Driver rows have a null employeeId. Row-scoped driver self-service is a later
 * commit and must land before any driver is given one.
 *
 * No second door: statusApi.updateStatus (lib/api.ts:1334) maps Invoice, Quotation, Booking, Asset
 * and Maintenance — there is no Incident entry, so this controller's status route has one caller.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/incidents')
export class IncidentsController {
  constructor(private service: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incident reports' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('summary')
  @ApiOperation({ summary: 'Incident summary stats' })
  summary() { return this.service.getSummary(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Log a new incident' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/resolve')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Resolve an incident' })
  resolve(@Param('id') id: string, @Body() body: any) { return this.service.resolve(id, body); }

  @Patch(':id/status')
  @RequirePermission('rentals', 2)
  updateStatus(@Param('id') id: string, @Body('status') status: IncidentStatus) {
    return this.service.updateStatus(id, status);
  }
}
