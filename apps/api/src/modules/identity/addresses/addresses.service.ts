import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@souq/shared';
import type { AddressInput } from '@souq/validation';
import { PrismaService, type Tx } from '../../../infra/prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId, deletedAt: null }, orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }] });
  }

  async get(userId: string, id: string) {
    const a = await this.prisma.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!a) throw new NotFoundError('Address');
    return a;
  }

  async create(userId: string, input: AddressInput) {
    return this.prisma.transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId, deletedAt: null } });
      const makeDefaultShipping = input.isDefaultShipping || count === 0;
      const makeDefaultBilling = input.isDefaultBilling || count === 0;
      await this.clearDefaults(tx, userId, makeDefaultShipping, makeDefaultBilling);
      return tx.address.create({ data: { ...input, userId, isDefaultShipping: makeDefaultShipping, isDefaultBilling: makeDefaultBilling } });
    });
  }

  async update(userId: string, id: string, input: Partial<AddressInput>) {
    await this.get(userId, id);
    return this.prisma.transaction(async (tx) => {
      await this.clearDefaults(tx, userId, !!input.isDefaultShipping, !!input.isDefaultBilling);
      return tx.address.update({ where: { id }, data: input });
    });
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.prisma.address.update({ where: { id }, data: { deletedAt: new Date(), isDefaultShipping: false, isDefaultBilling: false } });
  }

  private async clearDefaults(tx: Tx, userId: string, shipping: boolean, billing: boolean) {
    if (shipping) await tx.address.updateMany({ where: { userId, isDefaultShipping: true }, data: { isDefaultShipping: false } });
    if (billing) await tx.address.updateMany({ where: { userId, isDefaultBilling: true }, data: { isDefaultBilling: false } });
  }
}
