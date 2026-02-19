import { Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'

export interface TransactionQuery {
  page?: number
  limit?: number
  search?: string
  type?: TransactionType
  status?: TransactionStatus
  from?: string
  to?: string
  accountId?: string
  cardId?: string
}

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
