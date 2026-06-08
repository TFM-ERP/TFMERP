import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QuotationStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/quotations')
export class QuotationsController {
  constructor(private service: QuotationsService) {}

  @Get()
  @ApiOperation({ summary: 'List quotations with filters and pagination' })
  findAll(@Query() query: QueryQuotationDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single quotation with all details and line items' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new quotation' })
  create(@Body() dto: CreateQuotationDto, @Request() req) {
    return this.service.create(dto, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update quotation (replaces line items if items[] is provided)' })
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto, @Request() req) {
    return this.service.update(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update quotation status (DRAFT → SENT → APPROVED → CONVERTED)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: QuotationStatus,
    @Body('notes') notes: string,
    @Request() req,
  ) {
    return this.service.updateStatus(id, status, req.user.id, notes);
  }

  @Post(':id/convert-to-invoice')
  @ApiOperation({ summary: 'Convert approved quotation to a draft Tax Invoice' })
  convertToInvoice(@Param('id') id: string, @Request() req) {
    return this.service.convertToInvoice(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a DRAFT quotation' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
