import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VatType } from '@prisma/client';

@Injectable()
export class VatService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { rate: 'asc' } });
  }

  create(data: { name: string; rate: number; vatType: VatType; description?: string; isDefault?: boolean }) {
    return this.prisma.taxRate.create({ data });
  }

  update(id: string, data: Partial<{ name: string; rate: number; vatType: VatType; description: string; isDefault: boolean; isActive: boolean }>) {
    return this.prisma.taxRate.update({ where: { id }, data });
  }

  /** Seed default UAE tax rates if none exist */
  async seedDefaults() {
    const count = await this.prisma.taxRate.count();
    if (count === 0) {
      await this.prisma.taxRate.createMany({
        data: [
          { name: 'UAE VAT 5%', rate: 5, vatType: VatType.STANDARD, isDefault: true },
          { name: 'Zero Rated (0%)', rate: 0, vatType: VatType.ZERO_RATED },
          { name: 'Exempt', rate: 0, vatType: VatType.EXEMPT },
          { name: 'Out of Scope', rate: 0, vatType: VatType.OUT_OF_SCOPE },
        ],
      });
    }
    return this.findAll();
  }
}
