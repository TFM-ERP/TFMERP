import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MasterScriptService } from './master-script.service';
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
@Controller('production/master-scripts')
export class MasterScriptController {
  constructor(private service: MasterScriptService) {}

  @Get() list(@Query('search') search?: string, @Query('status') status?: string) { return this.service.list({ search, status }); }
  @Get('stats') stats() { return this.service.stats(); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }

  @Post() @RequirePermission('production', 2) create(@Body() b: any, @Req() req: any) { return this.service.create(b, req.user?.id); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/revision') @RequirePermission('production', 2) @UseInterceptors(FileInterceptor('file', pdfUpload))
  addRevision(@Param('id') id: string, @UploadedFile() file: any, @Body() b: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No PDF uploaded.');
    return this.service.addRevision(id, `/uploads/${file.filename}`, file.path, b, req.user?.id);
  }
  @Delete('revision/:id') @RequirePermission('production', 2) removeRevision(@Param('id') id: string) { return this.service.removeRevision(id); }

  @Put(':id/palette') @RequirePermission('production', 2) setPalette(@Param('id') id: string, @Body() b: any) { return this.service.setPalette(id, b); }

  @Post(':id/link/:projectId') @RequirePermission('production', 2)
  link(@Param('id') id: string, @Param('projectId') projectId: string, @Req() req: any) { return this.service.linkToProject(id, projectId, req.user?.id); }
  @Post('promote/:documentId') @RequirePermission('production', 2)
  promote(@Param('documentId') documentId: string, @Body() b: any, @Req() req: any) { return this.service.promoteFromDocument(documentId, b, req.user?.id); }
  @Post('pull/:documentId') @RequirePermission('production', 2)
  pull(@Param('documentId') documentId: string, @Req() req: any) { return this.service.pullLatest(documentId, req.user?.id); }
}
