import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScriptService } from './script.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { revisionWheel } from './revision-wheel.util';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const pdfUpload = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_r: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_r: any, file: any, cb: any) =>
    /\.(pdf|fdx)$/i.test(extname(file.originalname)) ? cb(null, true) : cb(new BadRequestException('Upload a PDF or Final Draft (.fdx) script.'), false),
};

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/script')
export class ScriptController {
  constructor(private service: ScriptService) {}

  @Get('project/:projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Get('project/:projectId/bin') binList(@Param('projectId') projectId: string) { return this.service.binList(projectId); }
  @Post('document/:id/trash') @RequirePermission('production', 2) trashDoc(@Param('id') id: string) { return this.service.trashDocument(id); }
  @Post('document/:id/restore') @RequirePermission('production', 2) restoreDoc(@Param('id') id: string) { return this.service.restoreDocument(id); }
  @Get('document/:id') getDocument(@Param('id') id: string) { return this.service.getDocument(id); }
  @Get('revision/:id') getRevision(@Param('id') id: string) { return this.service.getRevision(id); }

  // THE COLOUR WHEEL, SERVED FROM ITS ONE OWNER.
  // The WGA sequence lived twice: here, where revisions are assigned from it, and again as a
  // hard-coded nine-colour pastel list in ScriptHubPanel.tsx which was missing TAN and carried
  // different hexes — so a manually-picked colour overwrote the canonical one on its way in.
  // Two copies of one convention is the defect shape; the frontend now reads this.
  @Get('revision-wheel') revisionWheel() { return { wheel: revisionWheel() }; }

  @Post('project/:projectId') @RequirePermission('production', 2)
  createDocument(@Param('projectId') projectId: string, @Body() b: any, @Req() req: any) {
    return this.service.createDocument(projectId, b, req.user?.id);
  }

  // Upload a PDF as a new revision (multipart: file + revisionLabel + colorCode)
  @Post('document/:id/revision') @RequirePermission('production', 2) @UseInterceptors(FileInterceptor('file', pdfUpload))
  addRevision(@Param('id') id: string, @UploadedFile() file: any, @Body() b: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No PDF uploaded.');
    return this.service.addRevision(id, `/uploads/${file.filename}`, file.path, b, req.user?.id);
  }

  @Put('document/:id/active/:revisionId') @RequirePermission('production', 2)
  setActive(@Param('id') id: string, @Param('revisionId') revisionId: string) { return this.service.setActiveRevision(id, revisionId); }

  // LEVEL 3, NOT 2 — these are the only two routes in this controller with no undo.
  //
  // The FKs here genuinely cascade: deleting a script_documents row takes its revisions, and through
  // them the scenes, coverage, bookmarks and annotation layers. There is no bin in front of either
  // route and no audit record behind them. Leaving them at level 2 — the same level as `trash`, which
  // is reversible — was the system asserting that a recoverable action and an unrecoverable one are
  // equally consequential. They are not. The builds path erred the other way, deleting too little and
  // stranding a million characters; this one deletes everything and leaves nothing to recover from.
  @Delete('revision/:id') @RequirePermission('production', 3) removeRevision(@Param('id') id: string) { return this.service.removeRevision(id); }
  @Delete('document/:id') @RequirePermission('production', 3) removeDocument(@Param('id') id: string) { return this.service.removeDocument(id); }
  // P0 script-spine — single-source projection status + revision metadata
  @Get('projection-status/:projectId') projectionStatus(@Param('projectId') projectId: string) { return this.service.projectionStatus(projectId); }
  @Put('revision/:id/meta') @RequirePermission('production', 2) setRevisionMeta(@Param('id') id: string, @Body() body: any) { return this.service.setRevisionMeta(id, body || {}); }
  @Post('revision/:id/lock') @RequirePermission('production', 2) lockRevision(@Param('id') id: string, @Body() body: any) { return this.service.lockRevision(id, body?.lock !== false); }
}
