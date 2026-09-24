import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DriverAppService } from './driver-app.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

/**
 * THE WHOLE CONTROLLER IS LOCKED AT rentals:2. THE REQUIREMENT IS ON THE CLASS, DELIBERATELY.
 *
 * This ran JwtAuthGuard alone, which meant PATCH submissions/:id/review — the route that turns a
 * driver's expense claim into a POSTED finance Expense (driver-app.service.ts:106-116, written with
 * status 'APPROVED') — was reachable by any authenticated user of any role, holding no finance
 * permission at all. review() also never compares the reviewer to the submitting driver, so the
 * same route is a self-approval path. And pending() takes no user and filters on nothing, so the
 * entire claims queue was readable by anyone logged in.
 *
 * NOTHING HERE IS OPEN. Unlike company or settings, this controller has no read that a general
 * dashboard page depends on. All six routes are the driver-claims surface and there are exactly
 * three callers, all of them rental screens: app/driver/page.tsx (the driver's own me/jobs/
 * submissions), and two staff approval screens — rental/driver-approvals/page.tsx:16,23 and
 * rental/logistics/page.tsx:64,318-319, both reading `pending` and calling `review`. So the level
 * goes on the CLASS and every route inherits it — including any route added later, which then
 * arrives locked instead of open. PermissionsGuard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so a per-handler decorator
 * would OVERRIDE this in either direction; the spec asserts none does.
 *
 * WHY 2 AND NOT 3. This is the lock-now level, matching every other driver-surface write in this
 * pass. DRIVER sits at rentals:1, so no driver can reach any of it — which is correct today and
 * MEASURED: all four Driver rows have a null employeeId, myDriver() resolves for nobody, and so
 * createSubmission throws for every account in the system. Zero submissions have ever been written
 * and review() has never created an Expense or a FuelLog. Row-scoped driver self-service is a later
 * commit, and must land before any driver is given a login.
 *
 * NOT IN THIS COMMIT: the claim logic itself — that a review should write PENDING rather than
 * APPROVED, that fuel should reach the books, and that a driver may not review their own claim.
 * That is driver-app.service.ts and belongs to the accounting session.
 */
@ApiTags('Driver App')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 2)
@Controller('driver-app')
export class DriverAppController {
  constructor(private service: DriverAppService) {}

  @Get('me')
  me(@Request() req) { return this.service.me(req.user.id); }

  @Get('jobs')
  jobs(@Request() req) { return this.service.myJobs(req.user.id); }

  @Post('submissions')
  createSubmission(@Request() req, @Body() body: any) { return this.service.createSubmission(req.user.id, body); }

  @Get('submissions')
  mySubmissions(@Request() req) { return this.service.mySubmissions(req.user.id); }

  @Get('submissions/pending')
  pending() { return this.service.pending(); }

  @Patch('submissions/:id/review')
  review(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; notes?: string }, @Request() req) {
    return this.service.review(id, body.status, req.user.id, body.notes);
  }
}
