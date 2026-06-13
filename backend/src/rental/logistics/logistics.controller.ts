import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LogisticsService } from './logistics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/logistics')
export class LogisticsController {
  constructor(private service: LogisticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Live logistics: active hires grouped by location with units, drivers & mileage' })
  overview() { return this.service.overview(); }

  @Patch('unit/:itemId/location')
  @ApiOperation({ summary: 'Assign a unit to a site within its hire' })
  assignUnit(@Param('itemId') itemId: string, @Body() b: { bookingLocationId: string | null }) {
    return this.service.assignUnit(itemId, b?.bookingLocationId ?? null);
  }

  @Patch('unit/:itemId/tow')
  @ApiOperation({ summary: 'Set the tow vehicle for a towed unit' })
  setTow(@Param('itemId') itemId: string, @Body() b: { towedById: string | null }) {
    return this.service.setTow(itemId, b?.towedById ?? null);
  }

  @Patch('unit/:itemId/reading')
  @ApiOperation({ summary: 'Record check-out / return odometer (self-driven units)' })
  recordReading(@Param('itemId') itemId: string, @Body() b: { kind: 'CHECKOUT' | 'RETURN'; odometer: number }) {
    return this.service.recordReading(itemId, b);
  }

  @Patch('location/:locationId/status')
  @ApiOperation({ summary: 'Advance a site status (PLANNED → IN_TRANSIT → ON_LOCATION → DONE)' })
  setLocationStatus(@Param('locationId') locationId: string, @Body() b: { status: string }) {
    return this.service.setLocationStatus(locationId, b?.status);
  }

  @Patch('location/:locationId')
  @ApiOperation({ summary: 'Update a site map pin / crew count / details' })
  updateLocation(@Param('locationId') locationId: string, @Body() b: any) {
    return this.service.updateLocation(locationId, b || {});
  }

  @Post('unit/:itemId/inspection')
  @ApiOperation({ summary: 'Log a check-out (DELIVERY) or check-in (RETURN) inspection' })
  logInspection(@Param('itemId') itemId: string, @Body() b: any) {
    return this.service.logInspection(itemId, b || {});
  }
}
