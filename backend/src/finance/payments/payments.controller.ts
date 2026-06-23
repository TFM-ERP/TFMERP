import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { PaymentStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('finance/payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get('summary')
  @ApiOperation({ summary: 'Payment summary: cleared, pending, bounced totals' })
  summary(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getSummary(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Mark payment as CLEARED, BOUNCED, or REFUNDED' })
  updateStatus(@Param('id') id: string, @Body('status') status: PaymentStatus) {
    return this.service.updateStatus(id, status);
  }
}
