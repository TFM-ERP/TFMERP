import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnnotationsService } from './annotations.service';
import { ScriptTransferService } from './script-transfer.service';
import { ScriptExportService } from './script-export.service';
import { ScriptProcurementService } from './script-procurement.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/script-annotations')
export class AnnotationsController {
  constructor(private service: AnnotationsService, private transfer: ScriptTransferService, private exporter: ScriptExportService, private procurement: ScriptProcurementService) {}

  // Secure annotated export (D8)
  @Post('export/:revisionId') exportPdf(@Param('revisionId') revisionId: string, @Body() b: any, @Req() req: any) {
    return this.exporter.exportPdf(revisionId, b, req.user?.id, req.user?.name || req.user?.email);
  }

  // Procurement staging — prop tag → draft budget line (D9)
  @Get('procurement/accounts/:projectId') procAccounts(@Param('projectId') projectId: string) { return this.procurement.accounts(projectId); }
  @Get('procurement/staging/:revisionId') procStaging(@Param('revisionId') revisionId: string) { return this.procurement.stagingList(revisionId); }
  @Post('procurement/:annotationId/stage') @RequirePermission('production', 2) procStage(@Param('annotationId') id: string, @Body() b: any) { return this.procurement.stage(id, b); }
  @Post('procurement/:annotationId/confirm') @RequirePermission('production', 2) procConfirm(@Param('annotationId') id: string) { return this.procurement.confirm(id); }
  @Delete('procurement/:annotationId/stage') @RequirePermission('production', 2) procUnstage(@Param('annotationId') id: string) { return this.procurement.unstage(id); }

  // Transfer + compare (D3)
  @Post('transfer/:sourceRevisionId/:targetRevisionId') @RequirePermission('production', 2)
  doTransfer(@Param('sourceRevisionId') s: string, @Param('targetRevisionId') t: string, @Req() req: any) { return this.transfer.transfer(s, t, req.user?.id); }
  @Get('orphans/:revisionId') orphans(@Param('revisionId') revisionId: string) { return this.transfer.orphans(revisionId); }
  @Put('orphans/:id/place') @RequirePermission('production', 2) placeOrphan(@Param('id') id: string, @Body() b: any) { return this.transfer.placeOrphan(id, b); }
  @Get('compare/:revA/:revB') compare(@Param('revA') revA: string, @Param('revB') revB: string) { return this.transfer.compare(revA, revB); }

  // Bookmarks (P2)
  @Get('bookmarks/:revisionId') bookmarks(@Param('revisionId') r: string) { return this.service.listBookmarks(r); }
  @Post('bookmarks/:revisionId') @RequirePermission('production', 2) addBookmark(@Param('revisionId') r: string, @Body() b: any, @Req() req: any) { return this.service.createBookmark(r, b, req.user?.id); }
  @Put('bookmark/:id') @RequirePermission('production', 2) editBookmark(@Param('id') id: string, @Body() b: any) { return this.service.updateBookmark(id, b); }
  @Delete('bookmark/:id') @RequirePermission('production', 2) removeBookmark(@Param('id') id: string) { return this.service.deleteBookmark(id); }

  // Tag categories + Auto-Tag + reports + scene special tags (P3)
  @Get('tag-categories/:projectId') tagCategories(@Param('projectId') p: string) { return this.service.listTagCategories(p); }
  @Post('tag-categories/:projectId') @RequirePermission('production', 2) addTagCategory(@Param('projectId') p: string, @Body() b: any) { return this.service.createTagCategory(p, b); }
  @Put('tag-category/:id') @RequirePermission('production', 2) editTagCategory(@Param('id') id: string, @Body() b: any) { return this.service.updateTagCategory(id, b); }
  @Delete('tag-category/:id') @RequirePermission('production', 2) removeTagCategory(@Param('id') id: string) { return this.service.deleteTagCategory(id); }
  @Post('tag-categories/:projectId/reorder') @RequirePermission('production', 2) reorderTagCategories(@Body() b: any) { return this.service.reorderTagCategories(b?.ids || []); }
  @Post('autotag-cast/:revisionId') @RequirePermission('production', 2) autoTagCast(@Param('revisionId') r: string, @Req() req: any) { return this.service.autoTagCast(r, req.user?.id); }
  @Get('tag-report/:revisionId') tagReport(@Param('revisionId') r: string) { return this.service.tagReport(r); }
  @Put('scene/:id') @RequirePermission('production', 2) updateScene(@Param('id') id: string, @Body() b: any) { return this.service.updateScene(id, b); }

  // Layers
  @Get('layers/:documentId') layers(@Param('documentId') documentId: string, @Req() req: any) { return this.service.listLayers(documentId, req.user?.id); }
  @Post('layers/:documentId') createLayer(@Param('documentId') documentId: string, @Body() b: any, @Req() req: any) { return this.service.createLayer(documentId, b, req.user?.id); }
  @Put('layers/:id') updateLayer(@Param('id') id: string, @Body() b: any) { return this.service.updateLayer(id, b); }
  @Delete('layers/:id') removeLayer(@Param('id') id: string) { return this.service.removeLayer(id); }

  // Layer shares (D4 IAM grants)
  @Get('layers/:id/shares') shares(@Param('id') id: string) { return this.service.listShares(id); }
  @Post('layers/:id/shares') addShare(@Param('id') id: string, @Body() b: any) { return this.service.addShare(id, b); }
  @Delete('shares/:shareId') removeShare(@Param('shareId') shareId: string) { return this.service.removeShare(shareId); }

  // Annotations
  @Get('revision/:revisionId') list(@Param('revisionId') revisionId: string, @Req() req: any) { return this.service.listAnnotations(revisionId, req.user?.id); }
  @Post() create(@Body() b: any, @Req() req: any) { return this.service.createAnnotation(b, req.user?.id); }
  @Put(':id') update(@Param('id') id: string, @Body() b: any) { return this.service.updateAnnotation(id, b); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.removeAnnotation(id); }
}
