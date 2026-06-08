import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TravelService } from './travel.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Travel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('travel')
export class TravelController {
  constructor(private service: TravelService) {}

  // Traveler identity (universal master)
  @Get('travelers') travelers(@Query('personType') personType?: string, @Query('includeCompanions') includeCompanions?: string, @Req() req?: any) { return this.service.listTravelers({ personType, includeCompanions }, req?.user?.role, req?.user?.id); }
  @Get('travelers/:id') traveler(@Param('id') id: string, @Req() req: any) { return this.service.getTraveler(id, req?.user?.role, req?.user?.id); }
  @Get('travelers/:id/readiness') readiness(@Param('id') id: string) { return this.service.readiness(id); }
  @Get('travelers/:id/arrival-sheet') arrivalSheet(@Param('id') id: string) { return this.service.arrivalSheet(id); }
  @Post('travelers') @RequirePermission('production', 2) addTraveler(@Body() b: any) { return this.service.createTraveler(b); }
  @Put('travelers/:id') @RequirePermission('production', 2) updTraveler(@Param('id') id: string, @Body() b: any) { return this.service.updateTraveler(id, b); }
  // Accompanying persons
  @Post('travelers/:id/companions') @RequirePermission('production', 2) addCompanion(@Param('id') id: string, @Body() b: any) { return this.service.addCompanion(id, b); }
  // Standing visas
  @Post('travelers/:id/visa-records') @RequirePermission('production', 2) addVisaRec(@Param('id') id: string, @Body() b: any) { return this.service.addVisaRecord(id, b); }
  @Put('visa-records/:id') @RequirePermission('production', 2) updVisaRec(@Param('id') id: string, @Body() b: any) { return this.service.updateVisaRecord(id, b); }
  @Delete('visa-records/:id') @RequirePermission('production', 2) delVisaRec(@Param('id') id: string) { return this.service.removeVisaRecord(id); }
  // Documents
  @Post('travelers/:id/documents') @RequirePermission('production', 2) addDoc(@Param('id') id: string, @Body() b: any) { return this.service.addDocument(id, b); }
  @Delete('documents/:id') @RequirePermission('production', 2) delDoc(@Param('id') id: string) { return this.service.removeDocument(id); }
  // Meet & greet
  @Post('travelers/:id/arrivals') @RequirePermission('production', 2) upsertArrival(@Param('id') id: string, @Body() b: any) { return this.service.upsertArrival(id, b); }
  // Travel Requirement Engine — compute travel/visa/hotel/transport need vs a destination
  @Post('travelers/:id/requirements') @RequirePermission('production', 2) requirements(@Param('id') id: string, @Body() b: any) { return this.service.applyRequirements(id, b); }
  // Smart connect: talent → travel identity
  @Post('identities/from-talent/:talentId') @RequirePermission('production', 2) fromTalent(@Param('talentId') talentId: string) { return this.service.ensureTalentIdentity(talentId); }
  @Post('identities/from-crew/:crewMemberId') @RequirePermission('production', 2) fromCrew(@Param('crewMemberId') crewMemberId: string) { return this.service.ensureCrewIdentity(crewMemberId); }

  // Trips
  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get('trips') trips(@Query('projectId') projectId?: string, @Query('scope') scope?: string) { return this.service.listTrips({ projectId, scope }); }
  @Get('trips/:id') trip(@Param('id') id: string) { return this.service.getTrip(id); }
  @Post('trips') @RequirePermission('production', 2) request(@Body() b: any, @Req() req: any) { return this.service.requestTrip(b, req.user?.id); }
  @Post('trips/:id/approve') @RequirePermission('production', 2) approve(@Param('id') id: string, @Req() req: any) { return this.service.approveTrip(id, req.user?.id); }
  @Post('trips/:id/expense-push') @RequirePermission('production', 2) push(@Param('id') id: string) { return this.service.pushExpenses(id); }

  // Itineraries & bookings
  @Post('trips/:id/itineraries') @RequirePermission('production', 2) addItinerary(@Param('id') id: string, @Body() b: any) { return this.service.createItinerary(id, b); }
  @Post('flights/search') searchFlights(@Body() b: any) { return this.service.searchFlights(b); }
  @Post('itineraries/:id/flights') @RequirePermission('production', 2) bookFlight(@Param('id') id: string, @Body() b: any) { return this.service.bookFlight(id, b); }
  @Post('itineraries/:id/hotels') @RequirePermission('production', 2) addHotel(@Param('id') id: string, @Body() b: any) { return this.service.addHotel(id, b); }
  @Post('itineraries/:id/cars') @RequirePermission('production', 2) addCar(@Param('id') id: string, @Body() b: any) { return this.service.addCar(id, b); }

  // Two-ledger
  @Post('itineraries/:id/commit') @RequirePermission('production', 2) commit(@Param('id') id: string, @Req() req: any) { return this.service.commitItinerary(id, req.user?.id); }
  @Post('itineraries/:id/post') @RequirePermission('production', 2) post(@Param('id') id: string, @Req() req: any) { return this.service.postItineraryActual(id, req.user?.id); }

  // Visas
  @Get('visas') visas(@Query('status') status?: string) { return this.service.listVisas(status); }
  @Patch('visas/:id') @RequirePermission('production', 2) updVisa(@Param('id') id: string, @Body() b: any) { return this.service.updateVisa(id, b); }
}
