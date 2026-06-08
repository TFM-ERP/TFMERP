import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsLibraryService } from './locations-library.service';
import { LocationOpsService } from './location-ops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Locations Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('locations-library')
export class LocationsLibraryController {
  constructor(private service: LocationsLibraryService, private ops: LocationOpsService) {}

  @Get() list(@Query() q: any) { return this.service.list(q); }
  @Get('stats') stats() { return this.service.stats(); }
  @Get('analytics') analytics() { return this.service.analytics(); }
  @Get('expiring') expiring(@Query('days') days?: string) { return this.service.expiringCompliance(days ? Number(days) : 30); }
  @Get('map-points') mapPoints() { return this.service.mapPoints(); }

  // ── Permit authority directory (standalone, company-wide) ───────────────────
  @Get('authorities') authorities() { return this.ops.listAuthorities(); }
  @Post('authorities') @RequirePermission('production', 2) upsertAuthority(@Body() b: any) { return this.ops.upsertAuthority(b); }
  @Delete('authorities/:id') @RequirePermission('production', 2) removeAuthority(@Param('id') id: string) { return this.ops.removeAuthority(id); }

  // ── Standalone operations on a MASTER library location ──────────────────────
  @Get(':id/permits') mPermits(@Param('id') id: string) { return this.ops.listPermits('master', id); }
  @Post(':id/permits') @RequirePermission('production', 2) mAddPermit(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.ops.createPermit('master', id, b, req.user?.id); }
  @Get(':id/documents') mDocs(@Param('id') id: string) { return this.ops.listDocuments('master', id); }
  @Post(':id/documents') @RequirePermission('production', 2) mAddDoc(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.ops.createDocument('master', id, b, req.user?.id); }
  @Get(':id/security') mSec(@Param('id') id: string) { return this.ops.listSecurity('master', id); }
  @Post(':id/security') @RequirePermission('production', 2) mAddSec(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.ops.createSecurity('master', id, b, req.user?.id); }
  @Get(':id/payments') mPay(@Param('id') id: string) { return this.ops.listPayments('master', id); }
  @Get(':id/payments/summary') mPaySum(@Param('id') id: string) { return this.ops.paymentSummary('master', id); }
  @Post(':id/payments') @RequirePermission('production', 2) mAddPay(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.ops.createPayment('master', id, b, req.user?.id); }

  // Shared by-id mutations (work for either scope)
  @Put('permit/:pid') @RequirePermission('production', 2) updPermit(@Param('pid') pid: string, @Body() b: any) { return this.ops.updatePermit(pid, b); }
  @Delete('permit/:pid') @RequirePermission('production', 2) delPermit(@Param('pid') pid: string) { return this.ops.removePermit(pid); }
  @Put('document/:did') @RequirePermission('production', 2) updDoc(@Param('did') did: string, @Body() b: any) { return this.ops.updateDocument(did, b); }
  @Delete('document/:did') @RequirePermission('production', 2) delDoc(@Param('did') did: string) { return this.ops.removeDocument(did); }
  @Put('security/:sid') @RequirePermission('production', 2) updSec(@Param('sid') sid: string, @Body() b: any) { return this.ops.updateSecurity(sid, b); }
  @Delete('security/:sid') @RequirePermission('production', 2) delSec(@Param('sid') sid: string) { return this.ops.removeSecurity(sid); }
  @Put('payment/:payId') @RequirePermission('production', 2) updPay(@Param('payId') payId: string, @Body() b: any) { return this.ops.updatePayment(payId, b); }
  @Delete('payment/:payId') @RequirePermission('production', 2) delPay(@Param('payId') payId: string) { return this.ops.removePayment(payId); }
  @Post('payment/:payId/paid') @RequirePermission('production', 2) markPaid(@Param('payId') payId: string) { return this.ops.markPaid(payId); }
  // Serves the map provider + browser key from backend/.env (key never baked into the build).
  @Get('map-config') mapConfig() {
    return { provider: process.env.MAPS_PROVIDER || 'google', apiKey: process.env.GOOGLE_MAPS_API_KEY || null };
  }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }

  @Post() @RequirePermission('production', 2)
  create(@Body() b: any, @Req() req: any) { return this.service.create(b, req.user?.id); }

  @Put(':id') @RequirePermission('production', 2)
  update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }

  @Patch(':id/archive') @RequirePermission('production', 2)
  archive(@Param('id') id: string) { return this.service.archive(id); }

  // Media
  @Post(':id/media') @RequirePermission('production', 2)
  addMedia(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.addMedia(id, b, req.user?.id); }
  @Patch('media/:mediaId/primary') @RequirePermission('production', 2)
  setPrimary(@Param('mediaId') mediaId: string) { return this.service.setPrimaryMedia(mediaId); }
  @Delete('media/:mediaId') @RequirePermission('production', 2)
  removeMedia(@Param('mediaId') mediaId: string) { return this.service.removeMedia(mediaId); }

  // Two-way integration
  @Post(':id/link/:projectId') @RequirePermission('production', 2)
  linkToProject(@Param('id') id: string, @Param('projectId') projectId: string, @Body() b: any) {
    return this.service.linkToProject(id, projectId, b);
  }
  @Post('promote/:locationId') @RequirePermission('production', 2)
  promote(@Param('locationId') locationId: string, @Req() req: any) {
    return this.service.promoteFromProject(locationId, req.user?.id);
  }
  @Post(':id/recompute-history') @RequirePermission('production', 2)
  recompute(@Param('id') id: string) { return this.service.recomputeHistory(id); }
}
