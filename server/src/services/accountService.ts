import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'
import { getGPABalance } from './marqetaService'
import { getNymbusAccountBalance } from './nymbusService'

/**
 * Returns all accounts belonging to `userId`, with live balance overlays
 * applied where the user has a linked payment-network account.
 *
 * Overlay precedence:
 * 1. **Marqeta** (Alice/Bob) — replaces `balanceCents` on the CHECKING account
 *    with the live GPA available balance.
 * 2. **Nymbus** (Carol/Dave) — replaces `balanceCents` with the Nymbus
 *    available balance and appends `ledgerBalanceCents` for the current balance.
 *
 * Falls back to the DB-stored balance if the external call fails.
 *
 * @param userId - The authenticated user's ID.
 * @returns Array of accounts, ordered by creation date ascending.
 *   Nymbus accounts include a runtime `ledgerBalanceCents` field.
 */
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

/**
 * Returns accounts owned by other users that have a Moov payment method,
 * making them valid destinations for Moov transfers.
 *
 * @param excludeUserId - The current user's ID (their own accounts are excluded).
 * @returns Array of partial account objects: `id`, `name`, `accountNumber`,
 *   `accountType`, and `moovPaymentMethodId`.
 */
export async function getMoovDestinations(excludeUserId: string) {
  return prisma.account.findMany({
    where: { moovPaymentMethodId: { not: null }, userId: { not: excludeUserId } },
    select: { id: true, name: true, accountNumber: true, accountType: true, moovPaymentMethodId: true },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Returns accounts owned by other users that have a Nymbus account ID,
 * making them valid destinations for Nymbus transfers.
 *
 * @param excludeUserId - The current user's ID (their own accounts are excluded).
 * @returns Array of partial account objects: `id`, `name`, `accountNumber`,
 *   `accountType`, and `nymbusAccountId`.
 */
export async function getNymbusDestinations(excludeUserId: string) {
  return prisma.account.findMany({
    where: { nymbusAccountId: { not: null }, userId: { not: excludeUserId } },
    select: { id: true, name: true, accountNumber: true, accountType: true, nymbusAccountId: true },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Fetches a single account by ID and enforces ownership.
 *
 * @param id - The account's primary key.
 * @param userId - The requesting user's ID.
 * @returns The full account record.
 * @throws {NotFoundError} If no account with `id` exists.
 * @throws {ForbiddenError} If the account belongs to a different user.
 */
export async function getAccountById(id: string, userId: string) {
  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) throw new NotFoundError('Account')
  if (account.userId !== userId) throw new ForbiddenError('Access denied')
  return account
}
