import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DamageService } from './damage.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/damage')
export class DamageController {
  constructor(private service: DamageService) {}

  @Get()
  @ApiOperation({ summary: 'List damage reports' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'File a new damage report' })
  create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Mark damage as resolved with final repair cost' })
  resolve(@Param('id') id: string, @Body('repairCost') repairCost: number) {
    return this.service.resolve(id, repairCost);
  }
}
