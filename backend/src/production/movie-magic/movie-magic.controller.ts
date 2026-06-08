import { Controller, Post, Get, Param, Body, Res, UploadedFiles, UseInterceptors, UseGuards, BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { MovieMagicService } from './movie-magic.service';
import { AiMappingService, UnmappedLine } from './ai-mapping.service';

// In-memory uploads (file.buffer) so the parser reads them directly. 25 MB cap.
const mmUpload = { limits: { fileSize: 25 * 1024 * 1024 } };

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/movie-magic')
export class MovieMagicController {
  constructor(private service: MovieMagicService, private aiMapping: AiMappingService) {}

  // AI CoA mapping suggestions for unmapped imported lines (read-only — nothing is written).
  @Post(':projectId/ai-map-lines')
  aiMapLines(@Param('projectId') projectId: string, @Body() body: { lines: UnmappedLine[] }) {
    return this.aiMapping.aiMapBudgetLines(projectId, body?.lines || []);
  }

  // AI-reviewed import, step 1: parse + AI-map. Writes NOTHING — returns the review payload.
  @Post(':projectId/import/ai-preview')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'mmbFile', maxCount: 1 }], mmUpload))
  aiPreview(@Param('projectId') projectId: string, @UploadedFiles() files: { mmbFile?: any[] }) {
    const mmb = files?.mmbFile?.[0];
    if (!mmb) throw new BadRequestException('Attach an MMB (.xml/.csv) file.');
    return this.service.previewImportWithAi(projectId, mmb);
  }

  // AI-reviewed import, step 2: human-approved lines → clone active version → inject into the WORKING copy.
  @Post(':projectId/import/ai-confirm')
  @RequirePermission('production', 2)
  aiConfirm(@Param('projectId') projectId: string, @Body() body: { versionName?: string; lines: any[] }) {
    return this.service.confirmAiImport(projectId, body);
  }

  // Import an MMB budget (.xml/.csv) and/or MMS schedule (.sex) into an existing project.
  @Post(':projectId/import')
  @RequirePermission('production', 2)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'mmbFile', maxCount: 1 }, { name: 'mmsFile', maxCount: 1 }], mmUpload))
  import(@Param('projectId') projectId: string, @UploadedFiles() files: { mmbFile?: any[]; mmsFile?: any[] }, @Body() body: any) {
    const mmb = files?.mmbFile?.[0];
    const mms = files?.mmsFile?.[0];
    if (!mmb && !mms) throw new BadRequestException('Attach an MMB (.xml/.csv) and/or MMS (.sex) file.');
    const strategy = body?.mergeStrategy === 'UPDATE_ACTIVE' ? 'UPDATE_ACTIVE' : 'NEW_VERSION';
    return this.service.initializeFromImports(projectId, mmb, mms, strategy);
  }

  // Export the active budget back to Movie Magic Budgeting XML.
  @Get(':projectId/export/mmb')
  async exportMmb(@Param('projectId') projectId: string, @Res() res: Response) {
    const xml = await this.service.exportBudgetToMMB(projectId);
    res.header('Content-Type', 'application/xml');
    res.attachment(`${projectId}_budget_mmb.xml`);
    res.send(xml);
  }

  // Export the stripboard + breakdown back to a Movie Magic Scheduling .sex file.
  @Get(':projectId/export/mms')
  async exportMms(@Param('projectId') projectId: string, @Res() res: Response) {
    const sex = await this.service.exportScheduleToSEX(projectId);
    res.header('Content-Type', 'application/xml');
    res.attachment(`${projectId}_schedule.sex`);
    res.send(sex);
  }
}
