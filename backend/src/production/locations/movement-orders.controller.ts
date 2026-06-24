import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MovementOrdersService } from './movement-orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/movement-orders')
export class MovementOrdersController {
  constructor(private service: MovementOrdersService) {}

  @Get(':projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Post() @RequirePermission('production', 2) create(@Body() b: any) { return this.service.create(b); }
  @Post('generate/:projectId') @RequirePermission('production', 2) generate(@Param('projectId') projectId: string) { return this.service.generate(projectId); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
}
