import { Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'

/** Query filters accepted by {@link getTransactions}. */
export interface TransactionQuery {
  /** Page number (1-based, default: 1). */
  page?: number
  /** Results per page (1–100, default: 20). */
  limit?: number
  /** Full-text search against memo and merchantName fields. */
  search?: string
  /** Filter to a single transaction type. */
  type?: TransactionType
  /** Filter to a single transaction status. */
  status?: TransactionStatus
  /** ISO-8601 date string — return transactions created on or after this date. */
  from?: string
  /** ISO-8601 date string — return transactions created on or before this date. */
  to?: string
  /** Scope results to a specific account (from or to). */
  accountId?: string
  /** Scope results to a specific card. */
  cardId?: string
}

/**
 * Returns a paginated list of transactions for the given user, applying
 * optional filters from `query`.
 *
 * Results include related `fromAccount`, `toAccount`, and `card` summary
 * objects. Only transactions where the user owns the source or destination
 * account are returned.
 *
 * @param userId - The authenticated user's ID.
 * @param query - Optional filter and pagination parameters.
 * @returns `{ transactions, pagination }` where `pagination` contains
 *   `page`, `limit`, `total`, and `totalPages`.
 */
export async function getTransactions(userId: string, query: TransactionQuery) {
  const page = Math.max(1, query.page ?? 1)
  const limit = Math.min(100, Math.max(1, query.limit ?? 20))
  const skip = (page - 1) * limit

  // Build where clause
  const where: Prisma.TransactionWhereInput = {
    OR: [
      { fromAccount: { userId } },
      { toAccount: { userId } },
    ],
  }

  if (query.accountId) {
    where.OR = [
      { fromAccountId: query.accountId, fromAccount: { userId } },
      { toAccountId: query.accountId, toAccount: { userId } },
    ]
  }

  if (query.cardId) {
    where.cardId = query.cardId
  }

  if (query.type) {
    // We need to apply extra filter alongside OR
    where.type = query.type
  }

  if (query.status) {
    where.status = query.status
  }

  if (query.from) {
    where.createdAt = { ...((where.createdAt as object) ?? {}), gte: new Date(query.from) }
  }

  if (query.to) {
    where.createdAt = { ...((where.createdAt as object) ?? {}), lte: new Date(query.to) }
  }

  if (query.search) {
    where.AND = [
      {
        OR: [
          { memo: { contains: query.search, mode: 'insensitive' } },
          { merchantName: { contains: query.search, mode: 'insensitive' } },
        ],
      },
    ]
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        fromAccount: { select: { id: true, name: true, accountNumber: true } },
        toAccount: { select: { id: true, name: true, accountNumber: true } },
        card: { select: { id: true, last4: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ])

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * Fetches a single transaction by ID and enforces ownership.
 *
 * The user must own either the source (`fromAccount`) or destination
 * (`toAccount`) of the transaction.
 *
 * @param id - The transaction's primary key.
 * @param userId - The requesting user's ID.
 * @returns The full transaction record with nested account and card summaries.
 * @throws {NotFoundError} If no transaction with `id` exists.
 * @throws {ForbiddenError} If the user owns neither account in the transaction.
 */
export async function getTransactionById(id: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    include: {
      fromAccount: { select: { id: true, name: true, accountNumber: true, userId: true } },
      toAccount: { select: { id: true, name: true, accountNumber: true, userId: true } },
      card: { select: { id: true, last4: true } },
    },
  })
  if (!tx) throw new NotFoundError('Transaction')

  const ownedByUser =
    tx.fromAccount?.userId === userId || tx.toAccount?.userId === userId
  if (!ownedByUser) throw new ForbiddenError('Access denied')

  return tx
}
