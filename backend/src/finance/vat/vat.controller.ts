import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { VatService } from './vat.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/vat')
export class VatController {
  constructor(private service: VatService) {}

  @Get()
  @ApiOperation({ summary: 'List all VAT / tax rates' })
  findAll() { return this.service.findAll(); }

  @Post('seed')
  @ApiOperation({ summary: 'Seed default UAE VAT rates (run once on setup)' })
  seed() { return this.service.seedDefaults(); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }
}
