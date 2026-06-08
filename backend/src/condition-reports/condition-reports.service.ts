import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ConditionReportsService {
  constructor(private prisma: PrismaService) {}

  listByBooking(bookingId: string) {
    return this.prisma.conditionReport.findMany({
      where: { bookingId },
      include: { asset: { select: { id: true, name: true } } },
      orderBy: { inspectedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.conditionReport.findUnique({
      where: { id },
      include: { asset: { select: { id: true, name: true } }, booking: { select: { id: true, bookingNumber: true, client: { select: { companyName: true } } } } },
    });
    if (!r) throw new NotFoundException('Condition report not found');
    return r;
  }

  create(data: any) {
    return this.prisma.conditionReport.create({
      data: {
        bookingId: data.bookingId,
        assetId: data.assetId || null,
        type: ['RETURN', 'PRETRIP'].includes(data.type) ? data.type : 'DELIVERY',
        inspectedAt: data.inspectedAt ? new Date(data.inspectedAt) : new Date(),
        inspectedBy: data.inspectedBy || null,
        odometer: data.odometer != null && data.odometer !== '' ? Number(data.odometer) : null,
        fuelLevel: data.fuelLevel || null,
        checklist: data.checklist ?? undefined,
        damageNotes: data.damageNotes || null,
        photos: Array.isArray(data.photos) ? data.photos : [],
        signatureName: data.signatureName || null,
        notes: data.notes || null,
      },
    });
  }

  remove(id: string) {
    return this.prisma.conditionReport.delete({ where: { id } });
  }
}
