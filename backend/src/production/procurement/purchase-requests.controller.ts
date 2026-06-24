import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseRequestsService } from './purchase-requests.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/purchase-requests')
export class PurchaseRequestsController {
  constructor(private service: PurchaseRequestsService) {}
  @Get() list(@Query('projectId') projectId: string, @Query('status') status?: string) { return this.service.list(projectId, status); }
  @Post() create(@Body() body: any, @Request() req: any) { return this.service.create(body, req.user?.id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }
  @Patch(':id/status') setStatus(@Param('id') id: string, @Body() body: any, @Request() req: any) { return this.service.setStatus(id, body.status, req.user?.id); }
  @Post(':id/convert') convert(@Param('id') id: string, @Request() req: any) { return this.service.convertToPo(id, req.user?.id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
