import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ContractStatus } from '@prisma/client';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { bookingId?: string; status?: ContractStatus; page?: number; limit?: number }) {
    const { bookingId, status, page = 1, limit = 25 } = query;
    const where: any = {};
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.rentalContract.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              client: { select: { id: true, companyName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.rentalContract.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            client: { include: { contacts: true } },
            items: {
              include: { asset: { select: { id: true, name: true, assetType: true, plateNumber: true } } },
            },
          },
        },
      },
    });
    if (!contract) throw new NotFoundException(`Contract ${id} not found`);
    return contract;
  }

  async findByBooking(bookingId: string) {
    return this.prisma.rentalContract.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: any) {
    const booking = await this.prisma.rentalBooking.findUnique({ where: { id: data.bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${data.bookingId} not found`);
    if (!['APPROVED', 'CONTRACT_SENT'].includes(booking.status as string)) {
      throw new BadRequestException('Contract can only be created for APPROVED or CONTRACT_SENT bookings');
    }

    const contract = await this.prisma.rentalContract.create({
      data: {
        bookingId: data.bookingId,
        contractNumber: data.contractNumber,
        status: 'DRAFT',
        terms: data.terms,
        notes: data.notes,
        signedAt: data.signedAt ? new Date(data.signedAt) : undefined,
        signedByName: data.signedByName,
      },
    });

    if (booking.status === 'APPROVED') {
      await this.prisma.rentalBooking.update({
        where: { id: data.bookingId },
        data: { status: 'CONTRACT_SENT' },
      });
    }

    return contract;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.rentalContract.update({
      where: { id },
      data: {
        terms: data.terms,
        notes: data.notes,
        signedAt: data.signedAt ? new Date(data.signedAt) : undefined,
        signedByName: data.signedByName,
      },
    });
  }

  async sign(id: string, signedByName: string) {
    const contract = await this.findOne(id);
    if (contract.status === 'SIGNED') {
      throw new BadRequestException('Contract is already signed');
    }

    const [updatedContract] = await this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: { status: 'SIGNED', signedAt: new Date(), signedByName },
      }),
      this.prisma.rentalBooking.update({
        where: { id: contract.bookingId },
        data: { status: 'CONTRACT_SIGNED' },
      }),
    ]);

    return updatedContract;
  }
}
