import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { JobStatus } from '@prisma/client';

/**
 * THE CLASS CARRIES A FLOOR, NOT THE ANSWER. Every route here is at least rentals:1; the writes
 * override upward, and the five money routes override onto a different key entirely.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could create a driver, rewrite
 * a driver's licence and bank details, generate a freelancer invoice, and approve and pay a payout.
 * Nothing here is open to the whole app — no dashboard page reads it — so the class floor is
 * rentals:1 rather than nothing, which means a route added here later arrives gated at view rather
 * than wide open. PermissionsGuard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each decorator below REPLACES the floor for its own route.
 *
 * THE MONEY SPLIT, WHICH IS THE POINT OF THIS COMMIT. @RequirePermission takes one {module, level},
 * so "rentals AND finance" cannot be written. The five money routes were therefore ruled one at a
 * time rather than as a block:
 *
 *   rentals:3 — generateInvoice and createPayout. These ASSEMBLE a claim from completed jobs; they
 *               are rental work, and the rental manager is who knows which jobs are real.
 *   finance:3 — pushPayroll, approvePayout and payPayout. These COMMIT money: into a payroll run,
 *               and into a posted expense. RENTAL_MANAGER holds finance:1, so the role that builds
 *               a payout can no longer approve and pay it as well.
 *
 * That is a deliberate segregation of duties, and it is the reason these five are not simply
 * rentals:3 together. FINANCE_MANAGER (finance:3, rentals:1) gains the committing half; ACCOUNTANT
 * (finance:2) gets neither half.
 *
 * KNOWN RESIDUAL, FINDING C — THE FLOOR IS NOT A NARROW READ. rentals:1 reads every driver row
 * whole — findAll issues findMany with no `select` (drivers.service.ts:145), so every scalar comes
 * back: Emirates ID, passport, visa and licence expiry, bank name, account number, IBAN, and the
 * daily and weekly rate the driver is paid. DRIVER sits at rentals:1, so these reads would reach a
 * driver login. A level cannot say "your own row", so narrowing this means a service-level select —
 * not changed here, and it waits on Qais. What covers it today is the standing rule that no driver
 * gets a login until row-scoped self-service lands. The spec pins the current reach so that any
 * change to it is deliberate.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
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
  @RequirePermission('rentals', 2)
  create(@Body() body: any) { return this.service.create(body); }

  /** Licence, passport, visa, Emirates ID, IBAN and day rate all live on this body. */
  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  // Performance
  @Get(':id/performance')
  @ApiOperation({ summary: 'Driver performance analytics' })
  getPerformance(@Param('id') id: string) { return this.service.getPerformance(id); }

  // Freelancer invoice
  @Post(':id/invoice')
  @RequirePermission('rentals', 3)
  @ApiOperation({ summary: 'Generate freelancer invoice for selected jobs' })
  generateInvoice(@Param('id') id: string, @Body('jobIds') jobIds: string[]) {
    return this.service.generateFreelancerInvoice(id, jobIds);
  }

  // Driver Jobs
  @Post('jobs')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Assign a driver job to a booking' })
  createJob(@Body() body: any) { return this.service.createJob(body); }

  @Get('jobs/booking/:bookingId')
  @ApiOperation({ summary: 'Get all jobs for a booking' })
  jobsByBooking(@Param('bookingId') bookingId: string) {
    return this.service.getJobsByBooking(bookingId);
  }

  // The two routes app/driver/page.tsx writes to. rentals:2 is the LOCK-NOW level ruled for every
  // driver-surface write: DRIVER sits at rentals:1 and so reaches neither. Row-scoped driver
  // self-service is a later commit and must land before any driver is given a login.
  @Patch('jobs/:jobId/status')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Update driver job status' })
  updateJobStatus(
    @Param('jobId') jobId: string,
    @Body('status') status: JobStatus,
    @Body('completedAt') completedAt?: string,
  ) { return this.service.updateJobStatus(jobId, status, completedAt); }

  @Put('jobs/:jobId')
  @RequirePermission('rentals', 2)
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

  // ASSEMBLING a payout is rental work — which jobs are real is the rental manager's knowledge.
  @Post(':id/payouts')
  @RequirePermission('rentals', 3)
  @ApiOperation({ summary: 'Create a freelance driver payout from completed jobs' })
  createPayout(@Param('id') id: string, @Body('jobIds') jobIds: string[]) { return this.service.createPayout(id, jobIds); }

  // COMMITTING it is finance work. From here down the key changes: RENTAL_MANAGER holds finance:1,
  // so the role that builds a payout cannot also approve and pay it.
  @Post(':id/push-payroll')
  @RequirePermission('finance', 3)
  @ApiOperation({ summary: 'Push direct-hire driver job allowances/bonus to a payroll run' })
  pushPayroll(@Param('id') id: string, @Body() body: { jobIds: string[]; month: number; year: number }) {
    return this.service.pushToPayroll(id, body.jobIds, Number(body.month), Number(body.year));
  }

  @Patch('payouts/:payoutId/approve')
  @RequirePermission('finance', 3)
  approvePayout(@Param('payoutId') payoutId: string) { return this.service.approvePayout(payoutId); }

  @Patch('payouts/:payoutId/pay')
  @RequirePermission('finance', 3)
  payPayout(@Param('payoutId') payoutId: string, @Body() body: any, @Request() req: any) {
    return this.service.payPayout(payoutId, body, req.user.id);
  }
}
