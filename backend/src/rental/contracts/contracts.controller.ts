import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/contracts')
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List contracts with optional filters' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create a contract for an approved booking' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/sign')
  @ApiOperation({ summary: 'Mark contract as signed and advance booking to CONTRACT_SIGNED' })
  sign(
    @Param('id') id: string,
    @Body('signedByName') signedByName: string,
  ) { return this.service.sign(id, signedByName); }
}
