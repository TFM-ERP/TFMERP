import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Transport')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('logistics/transport')
export class TransportController {
  constructor(private service: TransportService) {}

  // Vehicles (in-house OR hired)
  @Get('vehicles') vehicles(@Query('projectId') projectId?: string, @Query('scope') scope?: string, @Query('source') source?: string) { return this.service.listVehicles({ projectId, scope, source }); }
  @Post('vehicles') @RequirePermission('production', 2) addVehicle(@Body() b: any) { return this.service.createVehicle(b); }
  @Put('vehicles/:id') @RequirePermission('production', 2) updVehicle(@Param('id') id: string, @Body() b: any) { return this.service.updateVehicle(id, b); }
  @Delete('vehicles/:id') @RequirePermission('production', 2) delVehicle(@Param('id') id: string) { return this.service.removeVehicle(id); }
  @Get('fleet-vehicles') fleetVehicles() { return this.service.fleetVehicles(); }

  // Drivers (in-house OR hired)
  @Get('drivers') drivers(@Query('source') source?: string) { return this.service.listDrivers({ source }); }
  @Post('drivers') @RequirePermission('production', 2) addDriver(@Body() b: any) { return this.service.createDriver(b); }
  @Put('drivers/:id') @RequirePermission('production', 2) updDriver(@Param('id') id: string, @Body() b: any) { return this.service.updateDriver(id, b); }
  @Delete('drivers/:id') @RequirePermission('production', 2) delDriver(@Param('id') id: string) { return this.service.removeDriver(id); }
  @Get('fleet-drivers') fleetDrivers() { return this.service.fleetDrivers(); }

  // Pickers
  @Get('suppliers') suppliers() { return this.service.rentalSuppliers(); }
  @Get('travelers') travelers(@Query('projectId') projectId: string) { return this.service.projectTravelers(projectId); }

  // Orders / movements
  @Get('orders') orders(@Query('projectId') projectId?: string, @Query('scope') scope?: string, @Query('date') date?: string, @Query('status') status?: string) { return this.service.listOrders({ projectId, scope, date, status }); }
  @Post('orders') @RequirePermission('production', 2) addOrder(@Body() b: any, @Req() r: any) { return this.service.createOrder(b, r.user?.id); }
  @Put('orders/:id') @RequirePermission('production', 2) updOrder(@Param('id') id: string, @Body() b: any) { return this.service.updateOrder(id, b); }
  @Delete('orders/:id') @RequirePermission('production', 2) delOrder(@Param('id') id: string) { return this.service.removeOrder(id); }
  @Post('orders/:id/passengers') @RequirePermission('production', 2) addPassenger(@Param('id') id: string, @Body() b: any) { return this.service.addPassenger(id, b.travelerId); }
  @Delete('passengers/:id') @RequirePermission('production', 2) delPassenger(@Param('id') id: string) { return this.service.removePassenger(id); }

  // Daily Movement Board
  @Get('movement-board') movementBoard(@Query('date') date: string, @Query('projectId') projectId?: string) { return this.service.movementBoard(projectId, date); }

  // SYS-12.E — Fuel
  @Get('fuel') fuel(@Query('projectId') projectId?: string, @Query('transportVehicleId') transportVehicleId?: string) { return this.service.listFuel({ projectId, transportVehicleId }); }
  @Post('fuel') @RequirePermission('production', 2) addFuel(@Body() b: any) { return this.service.addFuel(b); }
  @Delete('fuel/:id') @RequirePermission('production', 2) delFuel(@Param('id') id: string) { return this.service.removeFuel(id); }
  @Get('fuel-report') fuelReport(@Query('projectId') projectId: string) { return this.service.fuelReport(projectId); }

  // SYS-12.E — Car rental → Two-Ledger
  @Post('vehicles/:id/commit') @RequirePermission('production', 2) commit(@Param('id') id: string, @Req() r: any) { return this.service.commitVehicle(id, r.user?.id); }
  @Post('vehicles/:id/post') @RequirePermission('production', 2) post(@Param('id') id: string, @Req() r: any) { return this.service.postVehicleActual(id, r.user?.id); }
}
