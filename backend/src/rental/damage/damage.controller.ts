import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DamageService } from './damage.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { CreateDamageDto } from './dto/create-damage.dto';

/**
 * Floor rentals:1 on the class, writes at rentals:2 — the shape ruled for all of rental/*.
 *
 * This ran JwtAuthGuard alone, so any authenticated user of any role could file damage against a
 * hire, edit the report, or close it. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each write decorator replaces the floor for its own route.
 *
 * WHAT resolve() ACTUALLY DOES, since it is easy to assume more: it writes resolvedAt and
 * repairCost on the damage report and nothing else (damage.service.ts:109-115). Outside this
 * module the only consumer of repairCost is a report row — reports.service.ts:280 renders it as
 * `cost`. Nothing bills a client from it. `clientLiable` is written by create and update but is
 * read nowhere in the backend, and resolve neither sets nor reads it. So rentals:2 here is the
 * step-2 default for a write, not a ruling about who may set client charges.
 *
 * IF DAMAGE CHARGES ARE EVER WIRED TO BILLING, that commit needs Qais's ruling before it lands —
 * the same prepare-versus-commit split the driver payouts got, where assembling a claim and
 * committing money ended up on different keys.
 *
 * MOST OF THIS SURFACE HAS NO CALLER. Only list and resolve are wired: damage/page.tsx:25 and :38.
 * get, create and update have no call site anywhere in the frontend, and the pages that link to
 * /rental/damage/new and /rental/damage/:id do not exist — those are dangling links. Gating them
 * costs nothing today, which is precisely why they are worth gating: they are reachable by any
 * authenticated user right now and nothing would notice if someone used them.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/damage')
export class DamageController {
  constructor(private service: DamageService) {}

  @Get()
  @ApiOperation({ summary: 'List damage reports' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'File a new damage report' })
  create(@Body() body: CreateDamageDto, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }

  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  /** Writes resolvedAt and repairCost. Read only by the damage report (reports.service.ts:280). */
  @Patch(':id/resolve')
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Mark damage as resolved with final repair cost' })
  resolve(@Param('id') id: string, @Body('repairCost') repairCost: number) {
    return this.service.resolve(id, repairCost);
  }
}
