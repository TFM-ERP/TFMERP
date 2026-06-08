import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get('summary')
  summary() { return this.service.summary(); }

  @Get('categories')
  categories() { return this.service.categories(); }

  @Get()
  list(@Query() q: any) { return this.service.list(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create an inventory item' })
  create(@Body() body: any, @Req() req: any) { return this.service.create(body, req.user?.id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/movements')
  @ApiOperation({ summary: 'Record a stock movement (IN / OUT / ADJUST)' })
  move(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.recordMovement(id, body, req.user?.id);
  }
}
