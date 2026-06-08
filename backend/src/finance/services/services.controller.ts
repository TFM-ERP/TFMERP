import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Service Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/services')
export class ServicesController {
  constructor(private service: ServicesService) {}

  // Cost centers (declare before :id routes)
  @Get('cost-centers')
  listCostCenters() { return this.service.listCostCenters(); }

  @Post('cost-centers')
  createCostCenter(@Body() body: any) { return this.service.createCostCenter(body); }

  @Put('cost-centers/:id')
  updateCostCenter(@Param('id') id: string, @Body() body: any) { return this.service.updateCostCenter(id, body); }

  @Delete('cost-centers/:id')
  deleteCostCenter(@Param('id') id: string) { return this.service.deleteCostCenter(id); }

  @Get('categories')
  categories() { return this.service.categories(); }

  // Service items
  @Get()
  @ApiOperation({ summary: 'List service catalog items' })
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) { return this.service.toggleActive(id); }
}
