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
  @Get('document/:id') getDocument(@Param('id') id: string) { return this.service.getDocument(id); }
  @Get('revision/:id') getRevision(@Param('id') id: string) { return this.service.getRevision(id); }

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

  @Delete('revision/:id') @RequirePermission('production', 2) removeRevision(@Param('id') id: string) { return this.service.removeRevision(id); }
  @Delete('document/:id') @RequirePermission('production', 2) removeDocument(@Param('id') id: string) { return this.service.removeDocument(id); }
}
