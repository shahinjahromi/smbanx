import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'
import { getGPABalance } from './marqetaService'

export async function getAccountsByUser(userId: string) {
  const [accounts, user] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.user.findUnique({ where: { id: userId }, select: { marqetaUserToken: true } }),
  ])

  // If this user has a Marqeta GPA, overlay the live balance on the CHECKING account
  if (user?.marqetaUserToken) {
    try {
      const { availableCents } = await getGPABalance(user.marqetaUserToken)
      return accounts.map((a) => {
        if (a.accountType === 'CHECKING') {
          return { ...a, balanceCents: availableCents }
        }
        return a
      })
    } catch {
      // Marqeta unavailable — fall back to DB balance
    }
  }

  return accounts
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
