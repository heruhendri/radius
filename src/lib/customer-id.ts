import { genCustomerId } from './utils';

export async function generateUniqueCustomerId(prisma: any, genFn = genCustomerId) {
  for (let i = 0; i < 10; i++) {
    const candidate = genFn();
    const exists = await prisma.pppoeUser.findFirst({ where: { customerId: candidate } as any });
    if (!exists) return candidate;
  }
  while (true) {
    const candidate = genFn();
    const exists = await prisma.pppoeUser.findFirst({ where: { customerId: candidate } as any });
    if (!exists) return candidate;
  }
}

export async function backfillCustomerIds(prisma: any) {
  const users = await prisma.pppoeUser.findMany({ where: { customerId: null }, select: { id: true } });
  let updated = 0;
  for (const user of users) {
    const id = await generateUniqueCustomerId(prisma);
    await prisma.pppoeUser.update({ where: { id: user.id }, data: { customerId: id } });
    updated++;
  }
  return updated;
}

export default {
  generateUniqueCustomerId,
  backfillCustomerIds,
};
