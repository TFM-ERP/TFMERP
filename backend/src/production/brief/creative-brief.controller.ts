import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CreativeBriefService } from './creative-brief.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/brief')
export class CreativeBriefController {
  constructor(private service: CreativeBriefService) {}
  @Get('project/:projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post('project/:projectId') @RequirePermission('production', 2) create(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.create(projectId, body || {}, req?.user?.id); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body || {}); }
  @Post(':id/extract') @RequirePermission('production', 2) extract(@Param('id') id: string) { return this.service.extract(id); }
  @Post(':id/scaffold') @RequirePermission('production', 2) scaffold(@Param('id') id: string) { return this.service.scaffold(id); }
  @Get('alignment/:projectId') alignment(@Param('projectId') projectId: string) { return this.service.alignment(projectId); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
}
