import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { BookingStatus } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AddLocationDto, UpdateLocationDto } from './dto/booking-location.dto';

/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could raise a hire, edit its
 * dates and rates, advance it through the status machine, and add, move or delete the sites it
 * travels between. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each write decorator replaces the floor for its own route.
 *
 * check-conflicts STAYS ON THE FLOOR. It is a POST only because it takes a body: the service reads
 * bookings for overlaps and writes nothing (bookings.service.ts:36), and the booking form calls it
 * while typing. Gating it at 2 would make the conflict warning vanish for a rentals:1 reader while
 * the rest of the form still rendered — a worse failure than refusing the save.
 *
 * PATCH :id/status has a SECOND DOOR, found by sweeping the URL rather than the client name:
 * statusApi.updateStatus (lib/api.ts:1334) PATCHes this exact path, and workflow/page.tsx:295 calls
 * it. That surface surfaces refusals through StatusChangeModal (it catches at :46 and renders at
 * :147), so it needs no change here.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List bookings with filters and pagination' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('dashboard')
  @ApiOperation({ summary: 'Rental dashboard summary counts' })
  dashboard() { return this.service.getDashboard(); }

  @Get('calendar')
  @ApiOperation({ summary: 'Bookings overlapping a given month' })
  calendar(@Query('year') year: string, @Query('month') month: string) {
    return this.service.getCalendar(Number(year), Number(month));
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Availability timeline (assets × bookings) over a date window' })
  timeline(@Query('from') from: string, @Query('to') to: string) {
    return this.service.assetTimeline(from, to);
  }

  @Get('utilization')
  @ApiOperation({ summary: 'Asset utilization & revenue per asset over a date window' })
  utilization(@Query('from') from: string, @Query('to') to: string) {
    return this.service.assetUtilization(from, to);
  }

  @Post('check-conflicts')
  @ApiOperation({ summary: 'Check assets for double-booking conflicts in a date range' })
  checkConflicts(@Body() body: CheckConflictsDto) {
    return this.service.checkConflicts(body.assetIds, body.startDate, body.endDate, body.excludeBookingId);
  }

  // Location schedule (sites a hire moves between)
  @Get(':id/locations')
  listLocations(@Param('id') id: string) { return this.service.listLocations(id); }

  @Post(':id/locations')
  @RequirePermission('rentals', 2)
  addLocation(@Param('id') id: string, @Body() body: AddLocationDto) { return this.service.addLocation(id, body); }

  @Put('locations/:locId')
  @RequirePermission('rentals', 2)
  updateLocation(@Param('locId') locId: string, @Body() body: UpdateLocationDto) { return this.service.updateLocation(locId, body); }

  @Delete('locations/:locId')
  @RequirePermission('rentals', 2)
  removeLocation(@Param('locId') locId: string) { return this.service.removeLocation(locId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Create a new rental booking (starts at INQUIRY)' })
  create(@Body() body: CreateBookingDto, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }

  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: UpdateBookingDto) {
    return this.service.update(id, body);
  }

  @Patch(':id/status')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Advance booking through the status machine' })
  updateStatus(@Param('id') id: string, @Body('status') status: BookingStatus) {
    return this.service.updateStatus(id, status);
  }
}
