import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CostingService } from './costing.service';

const INVOICE_TYPES = /\.(pdf|jpg|jpeg|png|webp)$/i;
const invoiceUpload = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads'),
    filename: (_req: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) =>
    INVOICE_TYPES.test(extname(file.originalname))
      ? cb(null, true)
      : cb(new BadRequestException('Only PDF or image invoices are allowed'), false),
};
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/costing')
export class CostingController {
  constructor(private service: CostingService) {}

  // Vendors
  @Get('vendors') vendors(@Query('projectId') projectId: string) { return this.service.vendors(projectId); }
  @Post('vendors') createVendor(@Body() body: any) { return this.service.createVendor(body); }
  @Put('vendors/:id') updateVendor(@Param('id') id: string, @Body() body: any) { return this.service.updateVendor(id, body); }
  @Delete('vendors/:id') removeVendor(@Param('id') id: string) { return this.service.removeVendor(id); }
  @Get('supplier-catalog') supplierCatalog(@Query('projectId') projectId: string) { return this.service.supplierCatalog(projectId); }
  @Post('vendors/add-from-suppliers') addFromSuppliers(@Body() body: any) { return this.service.addFromSuppliers(body.projectId, body.supplierIds || []); }
  @Post('vendors/:id/refresh-from-supplier') refreshVendor(@Param('id') id: string) { return this.service.refreshVendorFromSupplier(id); }

  // Cost report
  @Get('report/:projectId') report(@Param('projectId') projectId: string) { return this.service.costReport(projectId); }
  @Get('snapshots/:projectId') snapshots(@Param('projectId') projectId: string) { return this.service.listSnapshots(projectId); }
  @Post('snapshots/:projectId') saveSnapshot(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.saveSnapshot(projectId, body?.label, req.user?.id); }
  @Patch('accounts/:accountId/etc') setEtc(@Param('accountId') accountId: string, @Body() body: { etcAmount: number | null }) { return this.service.setEtc(accountId, body.etcAmount); }
  @Get('finance-summary/:projectId') financeSummary(@Param('projectId') projectId: string) { return this.service.financeSummary(projectId); }
  @Get('overspend/:projectId') overspend(@Param('projectId') projectId: string) { return this.service.overspendSuggestions(projectId); }

  // Budget transfers (line-to-line reallocation)
  @Get('transfers') listTransfers(@Query('projectId') projectId: string) { return this.service.listTransfers(projectId); }
  @Post('transfers') createTransfer(@Body() body: any, @Req() req: any) { return this.service.createTransfer(body, req.user?.id); }
  @Patch('transfers/:id/status') setTransferStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: any) { return this.service.setTransferStatus(id, body.status, req.user?.id); }
  @Delete('transfers/:id') removeTransfer(@Param('id') id: string) { return this.service.removeTransfer(id); }

  // Purchase orders
  @Get('pos') listPos(@Query('projectId') projectId: string, @Query() q: any) { return this.service.listPos(projectId, q); }
  @Post('pos') createPo(@Body() body: any, @Req() req: any) { return this.service.createPo(body, req.user?.id); }
  @Put('pos/:id') updatePo(@Param('id') id: string, @Body() body: any) { return this.service.updatePo(id, body); }
  @Patch('pos/:id/status') setPoStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: any) { return this.service.setPoStatus(id, body.status, req.user?.id); }
  @Post('pos/:id/submit-approval') submitPo(@Param('id') id: string, @Req() req: any) { return this.service.submitPoForApproval(id, req.user?.id); }
  @Post('pos/:id/revise') revisePo(@Param('id') id: string) { return this.service.revisePo(id); }
  @Post('pos/:id/invoice') invoicePo(@Param('id') id: string, @Body() body: any, @Req() req: any) { return this.service.invoicePo(id, body, req.user?.id); }
  @Post('pos/:id/upload-invoice')
  @UseInterceptors(FileInterceptor('file', invoiceUpload))
  uploadInvoice(@Param('id') id: string, @UploadedFile() file: any, @Req() req: any) { return this.service.uploadInvoice(id, file, req.user?.id); }

  // V1.2 expanded OCR — petty-cash receipt → DRAFT spend; timesheet → PENDING timecard
  @Post('floats/:floatId/upload-receipt')
  @RequirePermission('production', 2)
  @UseInterceptors(FileInterceptor('file', invoiceUpload))
  uploadReceipt(@Param('floatId') floatId: string, @UploadedFile() file: any, @Body() body: any, @Req() req: any) {
    return this.service.uploadReceipt(floatId, file, body, req.user?.id);
  }

  @Post('timesheets/:projectId/upload')
  @RequirePermission('production', 2)
  @UseInterceptors(FileInterceptor('file', invoiceUpload))
  uploadTimesheet(@Param('projectId') projectId: string, @UploadedFile() file: any, @Req() req: any) {
    return this.service.uploadTimesheet(projectId, file, req.user?.id);
  }
  @Delete('pos/:id') removePo(@Param('id') id: string) { return this.service.removePo(id); }

  // Petty cash
  @Get('floats') floats(@Query('projectId') projectId: string) { return this.service.floats(projectId); }
  @Post('floats') createFloat(@Body() body: any) { return this.service.createFloat(body); }
  @Patch('floats/:id/close') closeFloat(@Param('id') id: string) { return this.service.closeFloat(id); }
  @Get('floats/:floatId/txns') pettyTxns(@Param('floatId') floatId: string) { return this.service.pettyTxns(floatId); }
  @Post('floats/:floatId/txns') addPettyTxn(@Param('floatId') floatId: string, @Body() body: any, @Req() req: any) { return this.service.addPettyTxn(floatId, body, req.user?.id); }
  @Delete('petty-txns/:id') removePettyTxn(@Param('id') id: string) { return this.service.removePettyTxn(id); }

  // Cash flow
  @Get('cashflow/:projectId') cashflow(@Param('projectId') projectId: string) { return this.service.cashflow(projectId); }
}
