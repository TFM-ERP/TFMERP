import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LocationReportsService } from './location-reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

const IMG = /\.(jpg|jpeg|png|webp|gif|heic)$/i;
const plateUpload = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads'),
    filename: (_r: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_r: any, file: any, cb: any) =>
    IMG.test(extname(file.originalname)) ? cb(null, true) : cb(new BadRequestException('Only image files are allowed'), false),
};

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/location-reports')
export class LocationReportsController {
  constructor(private service: LocationReportsService) {}

  // Plates
  @Get('plates') listPlates(@Query('locationId') locationId?: string, @Query('visitId') visitId?: string, @Query('projectId') projectId?: string) {
    return this.service.listPlates({ locationId, visitId, projectId });
  }
  @Post('plates') @RequirePermission('production', 2) createPlate(@Body() b: any, @Req() req: any) { return this.service.createPlate({ ...b, uploadedById: req.user?.id }); }
  @Post('plates/upload') @RequirePermission('production', 2) @UseInterceptors(FileInterceptor('file', plateUpload))
  uploadPlate(@UploadedFile() file: any, @Body() b: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return this.service.createPlate({ ...b, url: `/uploads/${file.filename}`, uploadedById: req.user?.id });
  }
  @Put('plates/:id') @RequirePermission('production', 2) updatePlate(@Param('id') id: string, @Body() b: any) { return this.service.updatePlate(id, b); }
  @Delete('plates/:id') @RequirePermission('production', 2) removePlate(@Param('id') id: string) { return this.service.removePlate(id); }
  @Post('plates/reorder') @RequirePermission('production', 2) reorderPlates(@Body() b: any) { return this.service.reorderPlates(b?.ids || []); }

  // Report / lookbook / storyboard reference
  @Get('report/:locationId') report(@Param('locationId') locationId: string) { return this.service.report(locationId); }
  @Get('lookbook') lookbook(@Query('locationId') locationId?: string, @Query('projectId') projectId?: string) { return this.service.lookbook({ locationId, projectId }); }
  @Get('storyboard') storyboard(@Query('locationId') locationId?: string, @Query('projectId') projectId?: string, @Query('sceneRef') sceneRef?: string) {
    return this.service.storyboardPlates({ locationId, projectId, sceneRef });
  }

  // Need option comparison + sign-off
  @Get('compare-need/:needId') compareNeed(@Param('needId') needId: string) { return this.service.compareNeed(needId); }
  @Post('sign-off/:needId') @RequirePermission('production', 2) signOff(@Param('needId') needId: string, @Body() b: any, @Req() req: any) {
    return this.service.signOffNeed(needId, { ...b, by: b?.by || req.user?.id });
  }
}
