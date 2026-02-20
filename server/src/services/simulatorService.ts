import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors'
import {
  simulateAuthorization,
  simulateClearing,
  simulateReversal,
  fundGPA,
} from './marqetaService'

type CardTxType = 'auth' | 'purchase' | 'credit'

/** Sanitise merchant name into a short MID string safe for Marqeta */
function toMid(merchantName: string) {
  return merchantName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40)
}

/**
 * Simulates a card transaction against a user's Marqeta-backed card.
 *
 * Behaviour varies by `type`:
 * - **`auth`** — Sends a Marqeta authorization (creates a PENDING hold on the GPA).
 *   The local transaction record is created in `PENDING` state.
 * - **`purchase`** — Sends a Marqeta authorization followed immediately by a
 *   clearing (settlement). The local transaction is created in `COMPLETED` state
 *   and `balanceCents` is decremented.
 * - **`credit`** — Issues a GPA funding order (refund). The local transaction is
 *   created as a `CREDIT` in `COMPLETED` state and `balanceCents` is incremented.
 *
 * @param cardId - The local card ID (DB primary key).
 * @param userId - The requesting user's ID (ownership check).
 * @param type - Transaction simulation type: `'auth'`, `'purchase'`, or `'credit'`.
 * @param amountCents - Transaction amount in cents.
 * @param merchantName - Merchant display name (used to derive the MID).
 * @param memo - Optional memo / description.
 * @returns The created transaction record.
 * @throws {NotFoundError} If the card does not exist.
 * @throws {ForbiddenError} If the card belongs to a different user.
 * @throws {AppError} With code `'CARD_FROZEN'` if the card is currently frozen.
 */
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
    include: { account: { include: { user: true } } },
  })

  if (!card) throw new NotFoundError('Card')
  if (card.account.userId !== userId) throw new ForbiddenError('Access denied')
  if (card.status === 'FROZEN') throw new AppError('Card is frozen', 400, 'CARD_FROZEN')

  const marqetaCardToken = card.marqetaCardToken
  const marqetaUserToken = card.account.user.marqetaUserToken

  if (type === 'auth') {
    // Real Marqeta authorization — creates a pending hold on the GPA
    let marqetaTransactionToken: string | undefined
    if (marqetaCardToken) {
      const mqTx = await simulateAuthorization(marqetaCardToken, amountCents, toMid(merchantName))
      marqetaTransactionToken = mqTx.token
    }

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
        marqetaTransactionToken,
      },
    })
  }

  if (type === 'purchase') {
    // Real Marqeta authorization + immediate clearing
    let marqetaTransactionToken: string | undefined
    if (marqetaCardToken) {
      const mqAuth = await simulateAuthorization(marqetaCardToken, amountCents, toMid(merchantName))
      await simulateClearing(mqAuth.token, amountCents)
      marqetaTransactionToken = mqAuth.token
    }

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
          marqetaTransactionToken,
        },
      }),
      // Sync local DB balance (Marqeta is source of truth but we keep DB in sync)
      prisma.account.update({
        where: { id: card.accountId },
        data: { balanceCents: { decrement: amountCents } },
      }),
    ])
    return tx
  }

  // credit — GPA order (funds returned to user's account)
  if (marqetaUserToken) {
    await fundGPA(marqetaUserToken, amountCents)
  }

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

/**
 * Posts (settles) a pending card authorization.
 *
 * Triggers a Marqeta clearing simulation, then marks the local transaction
 * as `COMPLETED` and decrements the account balance.
 *
 * @param transactionId - The local transaction ID to post.
 * @param userId - The requesting user's ID (ownership check).
 * @returns The updated transaction record in `COMPLETED` state.
 * @throws {NotFoundError} If the transaction does not exist.
 * @throws {AppError} With code `'INVALID_PROVIDER'` if the transaction is not a card transaction.
 * @throws {AppError} With code `'INVALID_STATE'` if the transaction is not in `PENDING` state.
 * @throws {ForbiddenError} If the transaction's account belongs to a different user.
 */
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

  // Real Marqeta clearing
  if (tx.marqetaTransactionToken) {
    await simulateClearing(tx.marqetaTransactionToken, tx.amountCents)
  }

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

/**
 * Voids (reverses) a pending card authorization.
 *
 * Triggers a Marqeta reversal simulation, then marks the local transaction
 * as `CANCELLED`. No balance change is made since the funds were never settled.
 *
 * @param transactionId - The local transaction ID to void.
 * @param userId - The requesting user's ID (ownership check).
 * @returns The updated transaction record in `CANCELLED` state.
 * @throws {NotFoundError} If the transaction does not exist.
 * @throws {AppError} With code `'INVALID_PROVIDER'` if the transaction is not a card transaction.
 * @throws {AppError} With code `'INVALID_STATE'` if the transaction is not in `PENDING` state.
 * @throws {ForbiddenError} If the transaction's account belongs to a different user.
 */
export async function cancelCardTransaction(transactionId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { toAccount: true },
  })

  if (!tx) throw new NotFoundError('Transaction')
  if (tx.provider !== 'card') throw new AppError('Not a card transaction', 400, 'INVALID_PROVIDER')
  if (tx.status !== 'PENDING') {
    throw new AppError(`Cannot void a ${tx.status.toLowerCase()} transaction`, 400, 'INVALID_STATE')
  }
  if (!tx.toAccount) throw new AppError('Invalid transaction', 500)
  if (tx.toAccount.userId !== userId) throw new ForbiddenError('Access denied')

  // Real Marqeta reversal (requires amount)
  if (tx.marqetaTransactionToken) {
    await simulateReversal(tx.marqetaTransactionToken, tx.amountCents)
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'CANCELLED' },
  })
}

/**
 * Returns all pending card authorizations for the given user.
 *
 * Only transactions with `provider = 'card'` and `status = 'PENDING'` that
 * credit an account owned by the user are returned.
 *
 * @param userId - The authenticated user's ID.
 * @returns Array of pending authorization transaction records with nested
 *   `toAccount` and `card` summaries, ordered newest first.
 */
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
