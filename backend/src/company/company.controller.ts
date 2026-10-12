import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { visibleBankAccounts } from '../finance/bank-accounts/bank-account-visibility';

/**
 * The profile as this caller may see it: everything, with the bank rows filtered by level.
 * A function, not a method: company.permissions.spec.ts counts every method on the controller as
 * a route that needs a ruling.
 */
async function profileFor(permissions: PermissionsService, user: any, profile: any) {
  return { ...profile, bankAccounts: await visibleBankAccounts(permissions, user, profile?.bankAccounts) };
}

/**
 * THE GUARD IS ON THE CLASS; THE REQUIREMENT IS ON EACH HANDLER.
 *
 * This controller ran JwtAuthGuard alone, so any authenticated user of any role could rewrite the
 * company's bank details, licence documents and trading addresses. PermissionsGuard was never in
 * the chain — and because it returns true for a route carrying no requirement
 * (permissions.guard.ts:14), attaching it at class level costs the open reads nothing while making
 * the writes gateable at all. NOTHING IS REQUIRED AT CLASS LEVEL, deliberately: SetupGate reads
 * GET /company on every page, so a class-level requirement would blank the app for every role
 * below the level.
 *
 * BANK ACCOUNTS ARE THE SAME ROWS THE FINANCE CONTROLLER WRITES. company.service and
 * finance/bank-accounts.service both write `prisma.bankAccount`, so a level on one door alone
 * leaves the rows reachable through the other. finance:3 here matches the level the finance door
 * is being raised to; its writes sit at finance:2 today and no frontend caller uses them.
 *
 * AND THE BANK-ACCOUNT LIST IS NOT OPEN. On feat/invoice-lifecycle that handler takes
 * ?includeOwner=true and returns the owner's personal account. finance:1 matches the finance
 * controller's own class-level read level; its callers — invoice and quotation new/edit, and this
 * page — are all finance:1 or better. Every OTHER GET here stays open.
 *
 * WHICH BANK ROWS COME BACK IS A SECOND RULE, APPLIED HERE AND NOT IN THE SERVICE. A COMPANY
 * account needs finance:1; an OWNER account — the GM's own — needs finance:2. GET /company is open
 * to every role and its profile carries the full bank list, so without this every signed-in user
 * received the owner's account on every page load. The filter sits on the way out of each handler
 * that returns bank rows (bank-account-visibility.ts). CompanyService.getProfile() stays unfiltered
 * because updateProfile() and completeSetup() call it internally.
 */
@ApiTags('Company Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('company')
export class CompanyController {
  constructor(private service: CompanyService, private permissions: PermissionsService) {}

  // Profile
  @Get()
  @ApiOperation({ summary: 'Get the master company profile' })
  async getProfile(@Req() req: any) {
    return profileFor(this.permissions, req.user, await this.service.getProfile());
  }

  /** finance:3 — the profile carries the TRN, licence numbers and letterhead used on every invoice. */
  @Put()
  @RequirePermission('finance', 3)
  @ApiOperation({ summary: 'Update the company profile' })
  async updateProfile(@Req() req: any, @Body() body: any) {
    return profileFor(this.permissions, req.user, await this.service.updateProfile(body));
  }

  @Post('complete-setup')
  @RequirePermission('setup', 2)
  @ApiOperation({ summary: 'Mark the initial company setup wizard complete' })
  async completeSetup(@Req() req: any, @Body() body: any) {
    // setup:2 says nothing about finance: the profile this returns is filtered like any other.
    return profileFor(this.permissions, req.user, await this.service.completeSetup(body));
  }

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'License / tax / document expiry alerts' })
  expiryAlerts(@Query('days') days?: string) {
    return this.service.expiryAlerts(days ? Number(days) : 60);
  }

  // Bank accounts
  @Get('bank-accounts')
  @RequirePermission('finance', 1)
  async listBankAccounts(@Req() req: any, @Query('includeOwner') includeOwner?: string) {
    // Company accounts only, unless the caller is the settings screen or the
    // record-payment form; the GM's personal account is never an invoice account.
    // includeOwner is a request, not a right: below finance:2 the owner rows are removed anyway.
    const rows = await this.service.listBankAccounts(includeOwner === 'true' || includeOwner === '1');
    return visibleBankAccounts(this.permissions, req.user, rows);
  }

  @Post('bank-accounts')
  @RequirePermission('finance', 3)
  createBankAccount(@Body() body: any) {
    return this.service.createBankAccount(body);
  }

  @Put('bank-accounts/:id')
  @RequirePermission('finance', 3)
  updateBankAccount(@Param('id') id: string, @Body() body: any) {
    return this.service.updateBankAccount(id, body);
  }

  @Delete('bank-accounts/:id')
  @RequirePermission('finance', 3)
  deleteBankAccount(@Param('id') id: string) {
    return this.service.deleteBankAccount(id);
  }

  // Locations
  @Get('locations')
  listLocations() {
    return this.service.listLocations();
  }

  @Post('locations')
  @RequirePermission('setup', 2)
  createLocation(@Body() body: any) {
    return this.service.createLocation(body);
  }

  @Put('locations/:id')
  @RequirePermission('setup', 2)
  updateLocation(@Param('id') id: string, @Body() body: any) {
    return this.service.updateLocation(id, body);
  }

  @Delete('locations/:id')
  @RequirePermission('setup', 2)
  deleteLocation(@Param('id') id: string) {
    return this.service.deleteLocation(id);
  }

  // Documents
  @Get('documents')
  listDocuments() {
    return this.service.listDocuments();
  }

  @Post('documents')
  @RequirePermission('setup', 2)
  createDocument(@Body() body: any) {
    return this.service.createDocument(body);
  }

  @Put('documents/:id')
  @RequirePermission('setup', 2)
  updateDocument(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDocument(id, body);
  }

  @Delete('documents/:id')
  @RequirePermission('setup', 2)
  deleteDocument(@Param('id') id: string) {
    return this.service.deleteDocument(id);
  }
}
