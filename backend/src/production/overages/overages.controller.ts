import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OveragesService } from './overages.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/overages')
export class OveragesController {
  constructor(private service: OveragesService) {}

  @Get()
  list(@Query('projectId') projectId: string) { return this.service.list(projectId); }

  @Post()
  create(@Body() body: any, @Req() req: any) { return this.service.create(body, req.user?.id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: any) {
    return this.service.setStatus(id, body.status, req.user?.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
