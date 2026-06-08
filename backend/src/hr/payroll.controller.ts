import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('HR — Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr/payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate a payroll run for a month/year' })
  generate(@Body() body: { month: number; year: number; notes?: string }) {
    return this.service.generate(Number(body.month), Number(body.year), body.notes);
  }

  @Put('payslips/:payslipId')
  updatePayslip(@Param('payslipId') payslipId: string, @Body() body: any) {
    return this.service.updatePayslip(payslipId, body);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.setStatus(id, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
