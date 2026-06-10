import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScriptAnalyzeService } from './script-analyze.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const audioUpload = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_r: any, file: any, cb: any) => cb(null, `audio-${randomUUID()}${extname(file.originalname).toLowerCase() || '.webm'}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_r: any, file: any, cb: any) =>
    /audio\//.test(file.mimetype) || /\.(webm|ogg|mp3|m4a|wav)$/i.test(file.originalname) ? cb(null, true) : cb(new BadRequestException('Only audio files are supported.'), false),
};

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/script-analyze')
export class ScriptAnalyzeController {
  constructor(private service: ScriptAnalyzeService) {}

  @Get('revision/:revisionId') analyze(@Param('revisionId') revisionId: string) { return this.service.analyze(revisionId); }

  // Audio notes
  @Get('audio/:revisionId') listAudio(@Param('revisionId') revisionId: string) { return this.service.listAudio(revisionId); }
  @Post('audio/:revisionId') @RequirePermission('production', 2) @UseInterceptors(FileInterceptor('file', audioUpload))
  addAudio(@Param('revisionId') revisionId: string, @UploadedFile() file: any, @Body() b: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No audio uploaded.');
    return this.service.addAudio(revisionId, `/uploads/${file.filename}`, b, req.user?.id);
  }
  @Delete('audio/:id') @RequirePermission('production', 2) removeAudio(@Param('id') id: string) { return this.service.removeAudio(id); }
}
