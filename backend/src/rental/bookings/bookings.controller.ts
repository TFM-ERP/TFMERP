import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BookingStatus } from '@prisma/client';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  checkConflicts(@Body() body: { assetIds: string[]; startDate: string; endDate: string; excludeBookingId?: string }) {
    return this.service.checkConflicts(body.assetIds, body.startDate, body.endDate, body.excludeBookingId);
  }

  // Location schedule (sites a hire moves between)
  @Get(':id/locations')
  listLocations(@Param('id') id: string) { return this.service.listLocations(id); }

  @Post(':id/locations')
  addLocation(@Param('id') id: string, @Body() body: any) { return this.service.addLocation(id, body); }

  @Put('locations/:locId')
  updateLocation(@Param('locId') locId: string, @Body() body: any) { return this.service.updateLocation(locId, body); }

  @Delete('locations/:locId')
  removeLocation(@Param('locId') locId: string) { return this.service.removeLocation(locId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create a new rental booking (starts at INQUIRY)' })
  create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Advance booking through the status machine' })
  updateStatus(@Param('id') id: string, @Body('status') status: BookingStatus) {
    return this.service.updateStatus(id, status);
  }
}
