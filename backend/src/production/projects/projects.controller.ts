import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/projects')
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Production dashboard stats (role-specific when ?role= is passed)' })
  dashboard(@Query('role') role?: string) { return this.service.getDashboard(role); }

  @Get()
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/workflow')
  workflow(@Param('id') id: string) { return this.service.workflow(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Post(':id/convert-currency')
  convertCurrency(@Param('id') id: string, @Body() body: any) { return this.service.convertCurrency(id, body?.toCurrency, body?.factor); }

  @Post(':id/inject-distribution')
  @ApiOperation({ summary: 'Append the optional 6000–9000 distribution/P&A ledger to the active budget' })
  injectDistribution(@Param('id') id: string) { return this.service.injectDistributionLedger(id); }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Clone a project (budget + crew) as a new project' })
  duplicate(@Param('id') id: string, @Body() body: any) { return this.service.duplicate(id, body?.crewScope || 'all'); }

  // Bulk archive — reversible dashboard cleanup (status → ARCHIVED)
  @Patch('bulk-archive')
  @RequirePermission('production', 2)
  bulkArchive(@Body() body: { projectIds: string[] }) { return this.service.bulkArchive(body?.projectIds || []); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  // Per-project authorization (V1.2)
  @Get('permission-templates')
  permissionTemplates() { return this.service.listPermissionTemplates(); }

  @Get(':id/team')
  projectTeam(@Param('id') id: string) { return this.service.projectTeam(id); }

  // The requesting user's effective per-project authority (null = global RBAC governs)
  @Get(':id/my-authority')
  myAuthority(@Param('id') id: string, @Req() req: any) { return this.service.projectAuthority(id, req.user?.id); }

  @Put(':id/team')
  @RequirePermission('production', 2)
  assignRole(@Param('id') id: string, @Body() body: { userId: string; templateId: string; notes?: string }) {
    return this.service.assignProjectRole(id, body);
  }

  @Delete(':id/team/:userId')
  @RequirePermission('production', 2)
  removeRole(@Param('id') id: string, @Param('userId') userId: string) {
    return this.service.removeProjectRole(id, userId);
  }

  // Dedicated production bank account (audit chain) — status + link/unlink
  @Get(':id/bank')
  projectBank(@Param('id') id: string) { return this.service.projectBank(id); }

  @Put(':id/bank')
  @RequirePermission('production', 2)
  linkProjectBank(@Param('id') id: string, @Body() body: { bankAccountId?: string | null; ledgerBankAccountId?: string | null }) {
    return this.service.linkProjectBank(id, body || {});
  }

  // Cascade-deletes the whole project. Locked/posted projects require ?force=true.
  @Delete(':id')
  @RequirePermission('production', 2)
  remove(@Param('id') id: string, @Query('force') force?: string) {
    return this.service.remove(id, force === 'true');
  }
}
