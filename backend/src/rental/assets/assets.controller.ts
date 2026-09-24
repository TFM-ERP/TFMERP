import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { AssetStatus, AssetType } from '@prisma/client';

/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could add, edit or re-status
 * a fleet asset. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each write decorator replaces the floor for its own route.
 *
 * THE FLOOR ON GET /rental/assets IS NOT FREE, AND IT WAS RULED WITH THAT KNOWN. This list is read
 * from outside rentals: LineItemsEditor.tsx:66 loads it on four finance screens — invoice new and
 * edit, quotation new and edit — and maintenance/{jobs,parts,tires} load it too. ACCOUNTANT holds
 * finance:2 and rentals:0, so from this commit the asset picker on those finance screens is empty
 * for that role. Qais ruled that the Accountant does not get rentals; the picker must say "no
 * access" rather than show nothing, and that is a separate commit on LineItemsEditor, which today
 * swallows the failure in a .catch(() => {}).
 *
 * PATCH :id/status has a SECOND DOOR: workflow/page.tsx:295 calls statusApi.updateStatus
 * (lib/api.ts:1334), which PATCHes this same route under a different client name. That surface
 * already shows refusals through StatusChangeModal, so it needs no change — but it is the reason
 * this route was swept by URL path rather than by client name.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/assets')
export class AssetsController {
  constructor(private service: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all assets with filters' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'Assets with registration or insurance expiring in 60 days' })
  expiryAlerts() { return this.service.getExpiryAlerts(); }

  @Get('utilization')
  @ApiOperation({ summary: 'Asset utilization report for a date range' })
  utilization(@Query('startDate') start: string, @Query('endDate') end: string) {
    return this.service.getUtilizationReport(start, end);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Check asset availability for a date range' })
  checkAvailability(
    @Param('id') id: string,
    @Query('startDate') start: string,
    @Query('endDate') end: string,
    @Query('excludeBookingId') excludeId?: string,
  ) { return this.service.checkAvailability(id, start, end, excludeId); }

  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Add a new asset (trailer, generator, vehicle, etc.)' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Update asset status (AVAILABLE, ON_HIRE, IN_MAINTENANCE, etc.)' })
  updateStatus(@Param('id') id: string, @Body('status') status: AssetStatus) {
    return this.service.updateStatus(id, status);
  }
}
