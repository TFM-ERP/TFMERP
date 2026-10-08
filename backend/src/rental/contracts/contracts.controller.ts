import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

/**
 * Floor rentals:1 on the class, writes at rentals:2, sign at rentals:3.
 *
 * This ran JwtAuthGuard alone. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so each write decorator replaces the floor for its own route.
 *
 * WHAT sign() ACTUALLY DOES, read before this was written (contracts.service.ts:104-122). It
 * refuses a contract already SIGNED, then in ONE TRANSACTION sets the contract to SIGNED with
 * signedAt = now and the supplied signedByName, and advances the booking to CONTRACT_SIGNED. So it
 * is not a field edit: it moves two entities together. That cross-entity write is why it sits a
 * level above the other writes here.
 *
 * WHAT rentals:3 THEREFORE GATES IS THE CONTRACT'S SIGNED STATE — NOT THE BOOKING'S. The booking
 * has its own door: ALLOWED_TRANSITIONS in bookings.service.ts:10 permits
 * CONTRACT_SENT -> CONTRACT_SIGNED, and updateStatus (:322-331) checks only that table — it never
 * looks for a contract, let alone a signed one. That route is PATCH /rental/bookings/:id/status at
 * rentals:2, also reached from the Workflow board through statusApi (lib/api.ts:1334). So a
 * rentals:2 holder can put a booking into CONTRACT_SIGNED without any contract existing. And since
 * there is no contract page at all, that status route is in practice the ONLY way a booking reaches
 * CONTRACT_SIGNED today. A level on one door is not a fence around the data. Closing this is
 * Qais's ruling — recorded as finding F — and the spec pins the gap meanwhile.
 *
 * WHAT IT DOES NOT DO: verify anybody. signedByName is a plain string off the request body — there
 * is no signature capture, no identity binding, and no check that the caller is the signatory. The
 * route records an assertion that a named person signed; it does not evidence it.
 *
 * NOR DOES IT FENCE THE SIGNATURE FIELDS. update() writes signedAt and signedByName too (:98-99),
 * and create() accepts both at creation (:76-77), and both sit at rentals:2. Only sign sets the
 * contract's status to SIGNED — but a rentals:2 holder can still write a signer name and date onto
 * a DRAFT contract. Nothing exercises that today, and whether it should be closed is a ruling, not
 * a default; it is written here so the gap is visible rather than assumed shut.
 *
 * THIS WHOLE CONTROLLER HAS NO FRONTEND CALLER. rentalApi.contracts exists in lib/api.ts:216-221
 * and no file calls any of its five methods; there is no app/(dashboard)/rental/contracts directory,
 * and the two links to /rental/contracts/:id and /rental/contracts/new
 * (rental/bookings/[id]/page.tsx:300, :327) point at pages that do not exist. Gating costs nothing
 * today, which is the reason to do it: every route here is reachable by any authenticated account
 * right now, and no screen would show it if one were used.
 */
@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('rentals', 1)
@Controller('rental/contracts')
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List contracts with optional filters' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  /** Also advances the booking APPROVED -> CONTRACT_SENT (contracts.service.ts:81-86). */
  @Post()
  @RequirePermission('rentals', 2)
  @ApiOperation({ summary: 'Create a contract for an approved booking' })
  create(@Body() body: any) { return this.service.create(body); }

  /** Writes terms, notes AND signedAt/signedByName — see the class note on the signature fields. */
  @Put(':id')
  @RequirePermission('rentals', 2)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  /**
   * rentals:3 — one transaction: contract -> SIGNED, booking -> CONTRACT_SIGNED. The level gates
   * THIS route only; the booking reaches CONTRACT_SIGNED independently through
   * PATCH /rental/bookings/:id/status at rentals:2 (see the class note).
   */
  @Patch(':id/sign')
  @RequirePermission('rentals', 3)
  @ApiOperation({ summary: 'Mark contract as signed and advance booking to CONTRACT_SIGNED' })
  sign(
    @Param('id') id: string,
    @Body('signedByName') signedByName: string,
  ) { return this.service.sign(id, signedByName); }
}
