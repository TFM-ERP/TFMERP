import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FuelService } from './fuel.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto';

/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each write decorator replaces the floor for its own route.
 *
 * WHAT THE SERVICE ACTUALLY DOES, read before this was written (fuel.service.ts):
 *   findAll   — reads fuelLog with its asset, paginated.
 *   getSummary— aggregates litres, cost, fill count and average cost per litre, grouped by asset.
 *   create    — requires the asset to exist, then computes totalCost as litres × costPerLitre
 *               SERVER-SIDE and stores it (:35). The caller does not supply the total.
 *   delete    — a HARD delete: prisma.fuelLog.delete (:56). No soft-delete column, no bin, no
 *               recovery. That is the one irreversible route on this controller.
 *
 * fuelLog HAS THREE WRITE DOORS, and this is only one of them:
 *   · here — create and delete, unguarded until this commit;
 *   · driver-app review() (driver-app.service.ts:97) creates one when a fuel claim is approved —
 *     locked at rentals:2 in 05f5629, so it matches this door;
 *   · logistics/transport (transport.controller.ts:47-48) — POST fuel and DELETE fuel/:id at
 *     production:2. addFuel accepts an assetId, so it writes against rental assets too, and
 *     removeFuel is prisma.fuelLog.delete({ where: { id } }) with no scoping, so it can delete a
 *     log created here.
 *
 * That third door means rentals:2 does not make these rows rentals-only: PRODUCTION_COORDINATOR
 * holds production:2 and rentals:0 and reaches them. It is a different module's controller and it
 * is already guarded, so nothing is changed there — it is recorded because a level on one door is
 * not a fence around the data.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/fuel')
export class FuelController {
  constructor(private service: FuelService) {}

  @Get()
  @ApiOperation({ summary: 'List fuel logs' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('summary')
  @ApiOperation({ summary: 'Fuel consumption summary with optional asset/date filters' })
  summary(
    @Query('assetId') assetId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) { return this.service.getSummary(assetId, startDate, endDate); }

  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Log a fuel fill-up for an asset' })
  create(@Body() body: CreateFuelLogDto) { return this.service.create(body); }

  /** Hard delete — fuel.service.ts:56 removes the row outright. Nothing restores it. */
  @Delete(':id')
  @RequirePermission('rentals', 2)
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
