import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LogisticsService } from './logistics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Rental')
@ApiBearerAuth()
/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could move a unit between
 * sites, advance a site through its status, re-pin a location, record odometers, log an inspection,
 * and hitch or unhitch a trailer. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each write decorator replaces the floor for its own route.
 *
 * WHAT THE EIGHT WRITES ACTUALLY TOUCH, read from logistics.service.ts rather than inferred:
 *   assignUnit / setTow / confirmHitch / unhitch  -> bookingItem, and towCoupling rows for the
 *        couplings (confirmHitch closes any open coupling first, then opens a new one).
 *   setLocationStatus / updateLocation            -> bookingLocation (status is validated against
 *        PLANNED / IN_TRANSIT / ON_LOCATION / DONE; ON_LOCATION also stamps arrivedAt).
 *   logInspection                                 -> conditionReport.
 *   recordReading                                 -> bookingItem odometers and allocationStatus,
 *        AND asset.currentOdometer when the new reading is higher (:185).
 *
 * FOUR OF THOSE ENTITIES HAVE A SECOND DOOR, swept before this level was described:
 *   · bookingLocation — also written by the bookings controller's add/update/removeLocation, at
 *     rentals:2 since 632d10b. Same key, same level: consistent.
 *   · asset.currentOdometer — also written by driver-app review() (driver-app.service.ts:104) at
 *     rentals:2, and by PATCH /pm/assets/:id/readings (pm.service.ts:100-103) which runs
 *     JwtAuthGuard ALONE. That door is still open to any authenticated account.
 *   · conditionReport — also created AND DELETED by the condition-reports controller
 *     (condition-reports.controller.ts:19, :22), which also runs JwtAuthGuard alone. So gating
 *     logInspection here does not protect inspection records: they can still be written and removed
 *     through that controller by anyone logged in.
 *   · bookingItem and towCoupling — swept for other writers (including nested `items: { create`)
 *     and this service is the only one.
 *
 * Both open doors are the deferred condition-reports + pm commit. They are recorded here because a
 * level on one door is not a fence around the data, and this controller's level would otherwise
 * read as more than it is.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/logistics')
export class LogisticsController {
  constructor(private service: LogisticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Live logistics: active hires grouped by location with units, drivers & mileage' })
  overview() { return this.service.overview(); }

  @Patch('unit/:itemId/location')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Assign a unit to a site within its hire' })
  assignUnit(@Param('itemId') itemId: string, @Body() b: { bookingLocationId: string | null }) {
    return this.service.assignUnit(itemId, b?.bookingLocationId ?? null);
  }

  @Patch('unit/:itemId/tow')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Set the tow vehicle for a towed unit' })
  setTow(@Param('itemId') itemId: string, @Body() b: { towedById: string | null }) {
    return this.service.setTow(itemId, b?.towedById ?? null);
  }

  @Patch('unit/:itemId/reading')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Record check-out / return odometer (self-driven units)' })
  recordReading(@Param('itemId') itemId: string, @Body() b: { kind: 'CHECKOUT' | 'RETURN'; odometer: number }) {
    return this.service.recordReading(itemId, b);
  }

  @Patch('location/:locationId/status')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Advance a site status (PLANNED → IN_TRANSIT → ON_LOCATION → DONE)' })
  setLocationStatus(@Param('locationId') locationId: string, @Body() b: { status: string }) {
    return this.service.setLocationStatus(locationId, b?.status);
  }

  @Patch('location/:locationId')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Update a site map pin / crew count / details' })
  updateLocation(@Param('locationId') locationId: string, @Body() b: any) {
    return this.service.updateLocation(locationId, b || {});
  }

  @Post('unit/:itemId/inspection')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Log a check-out (DELIVERY) or check-in (RETURN) inspection' })
  logInspection(@Param('itemId') itemId: string, @Body() b: any) {
    return this.service.logInspection(itemId, b || {});
  }

  @Patch('unit/:itemId/hitch')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Confirm a trailer is hitched to a tow vehicle (or external)' })
  confirmHitch(@Param('itemId') itemId: string, @Body() b: any) {
    return this.service.confirmHitch(itemId, b || {});
  }

  @Patch('unit/:itemId/unhitch')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Unhitch a trailer (close the coupling)' })
  unhitch(@Param('itemId') itemId: string, @Body() b: { by?: string }) {
    return this.service.unhitch(itemId, b?.by);
  }

  @Get('booking/:bookingId/dispatch-check')
  @ApiOperation({ summary: 'Check whether all units are dispatchable (none in maintenance)' })
  dispatchCheck(@Param('bookingId') bookingId: string) {
    return this.service.dispatchCheck(bookingId);
  }
}
