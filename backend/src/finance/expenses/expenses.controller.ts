import { Controller, Get, Post, Put, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/expenses')
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Get('summary')
  summary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.service.getSummary(startDate, endDate);
  }

  @Get('categories')
  categories() { return this.service.getCategories(); }

  @Get()
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Submit a new expense claim' })
  create(@Body() body: any, @Req() req: any) {
    return this.service.create({ ...body, createdById: req.user.id });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve an expense (Finance Manager / System Admin)' })
  approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    return this.service.reject(id, req.user.id);
  }

  @Patch(':id/paid')
  markPaid(@Param('id') id: string) {
    return this.service.markPaid(id);
  }
}
