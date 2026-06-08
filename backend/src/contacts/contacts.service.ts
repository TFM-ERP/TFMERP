import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    search?: string;
    contactType?: string;
    clientId?: string;
    vendorId?: string;
    supplierId?: string;
    driverId?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { jobTitle: { contains: query.search, mode: 'insensitive' } },
        { company: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { landline: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.contactType) where.contactType = query.contactType;
    if (query.clientId) where.clientId = query.clientId;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.driverId) where.driverId = query.driverId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          client: { select: { id: true, companyName: true } },
          vendor: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          driver: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { items, total, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, companyName: true } },
        vendor: { select: { id: true, name: true, vendorType: true } },
        supplier: { select: { id: true, name: true } },
        driver: { select: { id: true, fullName: true } },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(dto: any) {
    return this.prisma.contact.create({ data: dto });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contact.delete({ where: { id } });
  }
}
