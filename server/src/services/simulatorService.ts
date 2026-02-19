import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors'

type CardTxType = 'auth' | 'purchase' | 'credit'

export async function createCardTransaction(
  cardId: string,
  userId: string,
  type: CardTxType,
  amountCents: number,
  merchantName: string,
  memo?: string,
) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { account: true },
  })

  if (!card) throw new NotFoundError('Card')
  if (card.account.userId !== userId) throw new ForbiddenError('Access denied')
  if (card.status === 'FROZEN') throw new AppError('Card is frozen', 400, 'CARD_FROZEN')

  if (type === 'auth') {
    // Auth: PENDING DEBIT — no balance change
    return prisma.transaction.create({
      data: {
        toAccountId: card.accountId,
        amountCents,
        type: 'DEBIT',
        status: 'PENDING',
        provider: 'card',
        cardId,
        merchantName,
        memo,
      },
    })
  }

  if (type === 'purchase') {
    // Purchase: COMPLETED DEBIT — deduct balance immediately
    const [tx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          toAccountId: card.accountId,
          amountCents,
          type: 'DEBIT',
          status: 'COMPLETED',
          provider: 'card',
          cardId,
          merchantName,
          memo,
        },
      }),
      prisma.account.update({
        where: { id: card.accountId },
        data: { balanceCents: { decrement: amountCents } },
      }),
    ])
    return tx
  }

  // credit: COMPLETED CREDIT — increment balance immediately
  const [tx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        toAccountId: card.accountId,
        amountCents,
        type: 'CREDIT',
        status: 'COMPLETED',
        provider: 'card',
        cardId,
        merchantName,
        memo,
      },
    }),
    prisma.account.update({
      where: { id: card.accountId },
      data: { balanceCents: { increment: amountCents } },
    }),
  ])
  return tx
}

export async function postCardTransaction(transactionId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { toAccount: true },
  })

  if (!tx) throw new NotFoundError('Transaction')
  if (tx.provider !== 'card') throw new AppError('Not a card transaction', 400, 'INVALID_PROVIDER')
  if (tx.status !== 'PENDING') {
    throw new AppError(`Transaction is already ${tx.status.toLowerCase()}`, 400, 'INVALID_STATE')
  }
  if (!tx.toAccount) throw new AppError('Invalid transaction', 500)
  if (tx.toAccount.userId !== userId) throw new ForbiddenError('Access denied')

  const [updatedTx] = await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED' },
    }),
    prisma.account.update({
      where: { id: tx.toAccount.id },
      data: { balanceCents: { decrement: tx.amountCents } },
    }),
  ])

  return updatedTx
}

export async function getPendingAuths(userId: string) {
  return prisma.transaction.findMany({
    where: {
      provider: 'card',
      status: 'PENDING',
      toAccount: { userId },
    },
    include: {
      toAccount: { select: { id: true, name: true, accountNumber: true } },
      card: { select: { id: true, last4: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}
