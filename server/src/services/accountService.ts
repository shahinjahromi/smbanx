import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'
import { getGPABalance } from './marqetaService'
import { getNymbusAccountBalance } from './nymbusService'

export async function getAccountsByUser(userId: string) {
  const [accounts, user] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { marqetaUserToken: true, nymbusCustomerId: true },
    }),
  ])

  // Marqeta overlay (Alice & Bob) — overlay live GPA balance on CHECKING account
  if (user?.marqetaUserToken) {
    try {
      const { availableCents } = await getGPABalance(user.marqetaUserToken)
      return accounts.map((a) =>
        a.accountType === 'CHECKING' ? { ...a, balanceCents: availableCents } : a,
      )
    } catch {
      // Marqeta unavailable — fall back to DB balance
    }
  }

  // Nymbus overlay (Carol & Dave) — overlay live Nymbus balance on each Nymbus account
  if (user?.nymbusCustomerId) {
    return Promise.all(
      accounts.map(async (a) => {
        if (!a.nymbusAccountId) return a
        try {
          const { availableCents, currentCents } = await getNymbusAccountBalance(a.nymbusAccountId)
          return { ...a, balanceCents: availableCents, ledgerBalanceCents: currentCents }
        } catch {
          return a
        }
      }),
    )
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

export async function getNymbusDestinations(excludeUserId: string) {
  return prisma.account.findMany({
    where: { nymbusAccountId: { not: null }, userId: { not: excludeUserId } },
    select: { id: true, name: true, accountNumber: true, accountType: true, nymbusAccountId: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) throw new NotFoundError('Account')
  if (account.userId !== userId) throw new ForbiddenError('Access denied')
  return account
}
