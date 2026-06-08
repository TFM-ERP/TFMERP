import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JobStatus } from '@prisma/client';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/drivers')
export class DriversController {
  constructor(private service: DriversService) {}

  @Get()
  @ApiOperation({ summary: 'List drivers' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'Drivers with license/passport/visa/Emirates ID expiring in 30 days' })
  expiryAlerts() { return this.service.getExpiryAlerts(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  // Performance
  @Get(':id/performance')
  @ApiOperation({ summary: 'Driver performance analytics' })
  getPerformance(@Param('id') id: string) { return this.service.getPerformance(id); }

  // Freelancer invoice
  @Post(':id/invoice')
  @ApiOperation({ summary: 'Generate freelancer invoice for selected jobs' })
  generateInvoice(@Param('id') id: string, @Body('jobIds') jobIds: string[]) {
    return this.service.generateFreelancerInvoice(id, jobIds);
  }

  // Driver Jobs
  @Post('jobs')
  @ApiOperation({ summary: 'Assign a driver job to a booking' })
  createJob(@Body() body: any) { return this.service.createJob(body); }

  @Get('jobs/booking/:bookingId')
  @ApiOperation({ summary: 'Get all jobs for a booking' })
  jobsByBooking(@Param('bookingId') bookingId: string) {
    return this.service.getJobsByBooking(bookingId);
  }

  @Patch('jobs/:jobId/status')
  @ApiOperation({ summary: 'Update driver job status' })
  updateJobStatus(
    @Param('jobId') jobId: string,
    @Body('status') status: JobStatus,
    @Body('completedAt') completedAt?: string,
  ) { return this.service.updateJobStatus(jobId, status, completedAt); }

  @Put('jobs/:jobId')
  @ApiOperation({ summary: 'Update job details (photos, expenses, signature, checklist)' })
  updateJob(@Param('jobId') jobId: string, @Body() body: any) {
    return this.service.updateJob(jobId, body);
  }

  // ── Payouts & payroll ──────────────────────────────────────────────────
  @Get(':id/unbilled-jobs')
  @ApiOperation({ summary: 'Completed jobs not yet paid out / pushed to payroll' })
  unbilledJobs(@Param('id') id: string) { return this.service.unbilledJobs(id); }

  @Get(':id/payouts')
  @ApiOperation({ summary: 'Payouts / payroll pushes for a driver' })
  listPayouts(@Param('id') id: string) { return this.service.listPayouts(id); }

  @Post(':id/payouts')
  @ApiOperation({ summary: 'Create a freelance driver payout from completed jobs' })
  createPayout(@Param('id') id: string, @Body('jobIds') jobIds: string[]) { return this.service.createPayout(id, jobIds); }

  @Post(':id/push-payroll')
  @ApiOperation({ summary: 'Push direct-hire driver job allowances/bonus to a payroll run' })
  pushPayroll(@Param('id') id: string, @Body() body: { jobIds: string[]; month: number; year: number }) {
    return this.service.pushToPayroll(id, body.jobIds, Number(body.month), Number(body.year));
  }

  @Patch('payouts/:payoutId/approve')
  approvePayout(@Param('payoutId') payoutId: string) { return this.service.approvePayout(payoutId); }

  @Patch('payouts/:payoutId/pay')
  payPayout(@Param('payoutId') payoutId: string, @Body() body: any, @Request() req: any) {
    return this.service.payPayout(payoutId, body, req.user.id);
  }
}
