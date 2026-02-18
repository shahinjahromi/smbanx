import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'

export async function getAccountsByUser(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getMoovDestinations(excludeUserId: string) {
  return prisma.account.findMany({
    where: { moovPaymentMethodId: { not: null }, userId: { not: excludeUserId } },
    select: { id: true, name: true, accountNumber: true, accountType: true, moovPaymentMethodId: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) throw new NotFoundError('Account')
  if (account.userId !== userId) throw new ForbiddenError('Access denied')
  return account
}
