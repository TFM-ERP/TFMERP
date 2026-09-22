import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { PaymentsService } from './payments.service';
import { SlipReaderService, SLIP_TMP_DIR } from './slip-reader.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { PaymentStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('finance/payments')
export class PaymentsController {
  constructor(private service: PaymentsService, private slips: SlipReaderService) {}

  /** Reads a payment slip and proposes the form's fields. Saves nothing but the temporary file. */
  @Post('read-slip')
  @RequirePermission('finance', 2)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Read a payment slip (OCR on the server; AI on the text only if needed). Nothing is recorded.' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: SLIP_TMP_DIR,
      filename: (_req, f, cb) => cb(null, `${randomUUID()}${extname(f.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, f, cb) => /\.(pdf|png|jpe?g|webp|heic)$/i.test(f.originalname)
      ? cb(null, true)
      : cb(new BadRequestException('A slip must be a PDF or an image (PNG, JPG, WEBP).'), false),
  }))
  readSlip(@UploadedFile() file: any, @Body('expenseId') expenseId?: string) {
    if (!file) throw new BadRequestException('Attach the slip.');
    return this.slips.read(file, expenseId || undefined);
  }

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get('summary')
  @ApiOperation({ summary: 'Payment summary: cleared, pending, bounced totals' })
  summary(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getSummary(startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id/status')
  @RequirePermission('finance', 2) // clearing/bouncing a payment is a money-state change
  @ApiOperation({ summary: 'Mark payment as CLEARED, BOUNCED, or REFUNDED' })
  updateStatus(@Param('id') id: string, @Body('status') status: PaymentStatus) {
    return this.service.updateStatus(id, status);
  }
}
