import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

const PERMIT_TYPES = /\.(pdf|jpg|jpeg|png|webp)$/i;
const permitUpload = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads'),
    filename: (_req: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) =>
    PERMIT_TYPES.test(extname(file.originalname)) ? cb(null, true) : cb(new BadRequestException('Only PDF or image permits are allowed'), false),
};
const msgUpload = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads'),
    filename: (_req: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase() || '.msg'}`),
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) =>
    /\.(msg|eml)$/i.test(extname(file.originalname)) ? cb(null, true) : cb(new BadRequestException('Only Outlook .msg files are allowed'), false),
};

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/locations')
export class LocationsController {
  constructor(private service: LocationsService) {}

  @Get(':projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Get('item/:id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post(':projectId') @RequirePermission('production', 2) create(@Param('projectId') projectId: string, @Body() b: any) { return this.service.create(projectId, b); }
  @Put('item/:id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  @Delete('item/:id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
  @Post('item/:id/post-fee') @RequirePermission('production', 2) postFee(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.postFee(id, b?.days, req.user?.id); }
  @Post('item/:id/post-cost') @RequirePermission('production', 2) postCost(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.postCost(id, b, req.user?.id); }

  // ── Permits ───────────────────────────────────────────────────────────────
  @Get('item/:id/permits') permits(@Param('id') id: string) { return this.service.listPermits(id); }
  @Post('item/:id/permits') @RequirePermission('production', 2) createPermit(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.createPermit(id, b, req.user?.id); }
  @Put('permits/:permitId') @RequirePermission('production', 2) updatePermit(@Param('permitId') permitId: string, @Body() b: any) { return this.service.updatePermit(permitId, b); }
  @Delete('permits/:permitId') @RequirePermission('production', 2) removePermit(@Param('permitId') permitId: string) { return this.service.removePermit(permitId); }
  @Post('permits/:permitId/submit') @RequirePermission('production', 2) submitPermit(@Param('permitId') permitId: string, @Req() req: any) { return this.service.submitPermitForApproval(permitId, req.user?.id); }
  @Get('permits/:permitId/workflow') permitWorkflow(@Param('permitId') permitId: string) { return this.service.permitWorkflow(permitId); }
  @Post('permits/ocr') @RequirePermission('production', 2)
  @UseInterceptors(FileInterceptor('file', permitUpload))
  ocrPermit(@UploadedFile() file: any) { return this.service.ocrPermit(file); }

  // ── Risk register ─────────────────────────────────────────────────────────
  @Get('item/:id/risks') risks(@Param('id') id: string) { return this.service.listRisks(id); }
  @Post('item/:id/risks') @RequirePermission('production', 2) createRisk(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.createRisk(id, b, req.user?.id); }
  @Put('risks/:riskId') @RequirePermission('production', 2) updateRisk(@Param('riskId') riskId: string, @Body() b: any) { return this.service.updateRisk(riskId, b); }
  @Delete('risks/:riskId') @RequirePermission('production', 2) removeRisk(@Param('riskId') riskId: string) { return this.service.removeRisk(riskId); }

  // ── Document vault & compliance (LM workflow) ───────────────────────────────
  @Get('item/:id/documents') documents(@Param('id') id: string) { return this.service.listDocuments(id); }
  @Post('item/:id/documents') @RequirePermission('production', 2) createDoc(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.createDocument(id, b, req.user?.id); }
  @Put('documents/:docId') @RequirePermission('production', 2) updateDoc(@Param('docId') docId: string, @Body() b: any) { return this.service.updateDocument(docId, b); }
  @Delete('documents/:docId') @RequirePermission('production', 2) removeDoc(@Param('docId') docId: string) { return this.service.removeDocument(docId); }
  @Post('item/:id/documents/upload') @RequirePermission('production', 2)
  @UseInterceptors(FileInterceptor('file', permitUpload))
  uploadDoc(@Param('id') id: string, @UploadedFile() file: any, @Body() b: any, @Req() req: any) { return this.service.uploadDocument(id, file, b, req.user?.id); }
  @Get('item/:id/compliance') compliance(@Param('id') id: string) { return this.service.compliance(id); }
  @Post('item/:id/stage') @RequirePermission('production', 2) setStage(@Param('id') id: string, @Body() b: any) { return this.service.setStage(id, b?.stage); }
  @Post('item/:id/noc') @RequirePermission('production', 2) generateNoc(@Param('id') id: string, @Body() b: any) { return this.service.generateNoc(id, b || {}); }

  // ── Email (.msg) intake → document vault ────────────────────────────────────
  @Post('item/:id/import-email') @RequirePermission('production', 2)
  @UseInterceptors(FileInterceptor('file', msgUpload))
  importEmail(@Param('id') id: string, @UploadedFile() file: any, @Req() req: any) { return this.service.importEmail('project', id, file, req.user?.id); }
  @Post('master/:id/import-email') @RequirePermission('production', 2)
  @UseInterceptors(FileInterceptor('file', msgUpload))
  importEmailMaster(@Param('id') id: string, @UploadedFile() file: any, @Req() req: any) { return this.service.importEmail('master', id, file, req.user?.id); }

  // ── Permit authority directory (shared) ─────────────────────────────────────
  @Get('authorities') authorities() { return this.service.authorities(); }

  // ── Security & marshals (project scope; ledger-aware) ───────────────────────
  @Get('item/:id/security') security(@Param('id') id: string) { return this.service.listSecurity(id); }
  @Post('item/:id/security') @RequirePermission('production', 2) addSecurity(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.createSecurity(id, b, req.user?.id); }
  @Put('security/:sid') @RequirePermission('production', 2) updSecurity(@Param('sid') sid: string, @Body() b: any) { return this.service.updateSecurity(sid, b); }
  @Delete('security/:sid') @RequirePermission('production', 2) delSecurity(@Param('sid') sid: string) { return this.service.removeSecurity(sid); }
  @Post('security/:sid/post-cost') @RequirePermission('production', 2) postSecurity(@Param('sid') sid: string, @Req() req: any) { return this.service.postSecurityCost(sid, req.user?.id); }

  // ── Payment schedule (project scope; ledger-aware) ──────────────────────────
  @Get('item/:id/payments') payments(@Param('id') id: string) { return this.service.listPayments(id); }
  @Get('item/:id/payments/summary') paymentSummary(@Param('id') id: string) { return this.service.paymentSummary(id); }
  @Post('item/:id/payments') @RequirePermission('production', 2) addPayment(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.createPayment(id, b, req.user?.id); }
  @Put('payments/:pid') @RequirePermission('production', 2) updPayment(@Param('pid') pid: string, @Body() b: any) { return this.service.updatePayment(pid, b); }
  @Delete('payments/:pid') @RequirePermission('production', 2) delPayment(@Param('pid') pid: string) { return this.service.removePayment(pid); }
  @Post('payments/:pid/pay') @RequirePermission('production', 2) pay(@Param('pid') pid: string, @Req() req: any) { return this.service.payPayment(pid, req.user?.id); }
}
