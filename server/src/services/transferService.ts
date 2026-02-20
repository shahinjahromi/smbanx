import { prisma } from '../config/prisma'
import { createPaymentIntent, confirmPaymentIntent, cancelPaymentIntent } from './stripeService'
import {
  createTransfer as moovCreateTransfer,
  getTransfer as moovGetTransfer,
  cancelTransfer as moovCancelTransfer,
} from './moovService'
import { createNymbusTransfer } from './nymbusService'
import { NotFoundError, ForbiddenError, AppError, ValidationError } from '../utils/errors'

type Provider = 'internal' | 'stripe' | 'moov' | 'nymbus'
type MoovRailType = 'ach-standard' | 'ach-same-day' | 'rtp' | 'fund'

/**
 * Creates a new transfer and returns provider-specific payment details.
 *
 * Behaviour varies by `provider`:
 * - **`internal`** — Direct balance transfer between the user's own accounts.
 *   Returns a `PENDING` transaction; no external payment gateway involved.
 * - **`stripe`** — Creates a Stripe PaymentIntent (unconfirmed). When `fromAccountId`
 *   is omitted, funds a single account via card charge. Returns `clientSecret`
 *   for client-side confirmation.
 * - **`moov`** — Submits a Moov transfer on the selected rail (ACH, RTP, etc.).
 *   Returns `feeCents` if the Moov platform fee is available.
 * - **`nymbus`** — Calls the Nymbus Core API to initiate a bank transfer between
 *   Nymbus-backed accounts. Requires both accounts to have `nymbusAccountId`
 *   and the source user to have `nymbusCustomerId`.
 *
 * @param userId - The authenticated user's ID (used for ownership checks).
 * @param fromAccountId - Source account ID. Optional only for Stripe card-funding.
 * @param toAccountId - Destination account ID.
 * @param amountCents - Transfer amount in cents (must be positive).
 * @param memo - Optional transfer description.
 * @param provider - Payment provider to use (default: `'stripe'`).
 * @param moovRailType - Rail type for Moov transfers (default: `'ach-standard'`).
 * @param paymentMethodId - Stripe payment method ID for card-funding flows.
 * @returns `{ transaction, paymentIntentId, clientSecret, feeCents? }`.
 * @throws {NotFoundError} If either account does not exist.
 * @throws {ForbiddenError} If the user does not own the source account.
 * @throws {ValidationError} If accounts are the same, required IDs are missing,
 *   or accounts lack required provider credentials.
 * @throws {AppError} With code `'INSUFFICIENT_FUNDS'` if the source balance is too low.
 */
export async function initiateTransfer(
  userId: string,
  fromAccountId: string | undefined,
  toAccountId: string,
  amountCents: number,
  memo?: string,
  provider: Provider = 'stripe',
  moovRailType?: MoovRailType,
  paymentMethodId?: string,
) {
  const toAccount = await prisma.account.findUnique({ where: { id: toAccountId } })
  if (!toAccount) throw new NotFoundError('Destination account')

  // For stripe card-funding, fromAccountId is not required
  if (provider === 'stripe' && !fromAccountId) {
    if (toAccount.userId !== userId) throw new ForbiddenError('Access denied to destination account')
    if (amountCents <= 0) throw new ValidationError('Amount must be positive')

    const pi = await createPaymentIntent(amountCents, toAccount.currency, memo, paymentMethodId)

    const [creditTx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          fromAccountId: null,
          toAccountId,
          amountCents,
          type: 'CREDIT',
          status: 'PENDING',
          memo,
          stripePaymentIntentId: pi.id,
          provider: 'stripe',
        },
      }),
    ])

    return { transaction: creditTx, paymentIntentId: pi.id, clientSecret: pi.client_secret }
  }

  // All other providers require fromAccountId
  if (!fromAccountId) throw new ValidationError('Source account is required')

  const fromAccount = await prisma.account.findUnique({ where: { id: fromAccountId } })
  if (!fromAccount) throw new NotFoundError('Source account')
  if (fromAccount.userId !== userId) throw new ForbiddenError('Access denied to source account')
  if (fromAccountId === toAccountId) throw new ValidationError('Cannot transfer to same account')
  if (amountCents <= 0) throw new ValidationError('Amount must be positive')
  if (fromAccount.balanceCents < amountCents) {
    throw new AppError('Insufficient funds', 400, 'INSUFFICIENT_FUNDS')
  }

  if (provider === 'internal') {
    if (toAccount.userId !== userId) {
      throw new ValidationError('Internal transfers must be between your own accounts')
    }

    const [debitTx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          fromAccountId,
          toAccountId,
          amountCents,
          type: 'DEBIT',
          status: 'PENDING',
          memo,
          provider: 'internal',
        },
      }),
    ])

    return { transaction: debitTx, paymentIntentId: null, clientSecret: null }
  }

  if (provider === 'moov') {
    const sourcePaymentMethodId = fromAccount.moovPaymentMethodId
    if (!sourcePaymentMethodId) {
      throw new ValidationError('Source account has no Moov payment method')
    }
    const destPaymentMethodId = toAccount.moovPaymentMethodId
    if (!destPaymentMethodId) {
      throw new ValidationError('Destination account has no Moov payment method')
    }

    const railType = moovRailType ?? 'ach-standard'
    const { transferId, status, moovFeeCents } = await moovCreateTransfer(
      sourcePaymentMethodId,
      destPaymentMethodId,
      amountCents,
      fromAccount.currency,
      railType,
      memo,
    )

    const [debitTx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          fromAccountId,
          toAccountId,
          amountCents,
          type: 'DEBIT',
          status: 'PENDING',
          memo,
          moovTransferId: transferId,
          provider: 'moov',
        },
      }),
    ])

    return { transaction: debitTx, paymentIntentId: transferId, clientSecret: null, feeCents: moovFeeCents }
  }

  if (provider === 'nymbus') {
    if (!fromAccount.nymbusAccountId) throw new ValidationError('Source account has no Nymbus account ID')
    if (!toAccount.nymbusAccountId) throw new ValidationError('Destination account has no Nymbus account ID')

    const fromUser = await prisma.user.findUnique({ where: { id: fromAccount.userId }, select: { nymbusCustomerId: true } })
    if (!fromUser?.nymbusCustomerId) throw new ValidationError('Source user has no Nymbus customer ID')

    const amountDollars = amountCents / 100
    const nymbusTransferId = await createNymbusTransfer(
      fromUser.nymbusCustomerId,
      fromAccount.nymbusAccountId,
      toAccount.nymbusAccountId,
      amountDollars,
      memo,
    )

    const [debitTx] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          fromAccountId,
          toAccountId,
          amountCents,
          type: 'DEBIT',
          status: 'PENDING',
          memo,
          nymbusTransferId,
          provider: 'nymbus',
        },
      }),
    ])
    return { transaction: debitTx, paymentIntentId: nymbusTransferId, clientSecret: null }
  }

  // Stripe path with fromAccount (legacy path, kept for compatibility)
  const pi = await createPaymentIntent(amountCents, fromAccount.currency, memo, paymentMethodId)

  const [debitTx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        fromAccountId,
        toAccountId,
        amountCents,
        type: 'DEBIT',
        status: 'PENDING',
        memo,
        stripePaymentIntentId: pi.id,
        provider: 'stripe',
      },
    }),
  ])

  return { transaction: debitTx, paymentIntentId: pi.id, clientSecret: pi.client_secret }
}

/**
 * Confirms a PENDING transfer, completing the payment and updating balances.
 *
 * Behaviour varies by provider:
 * - **`internal`** — Atomically decrements source and increments destination balance.
 * - **`nymbus`** — Marks COMPLETED and syncs DB balances (Nymbus side already settled).
 * - **`moov`** — Checks Moov transfer status; completes optimistically if not failed.
 * - **`stripe`** — Calls `confirmPaymentIntent`; adjusts balances on success.
 *
 * @param transactionId - The transaction's primary key.
 * @param userId - The requesting user's ID (ownership check).
 * @returns The updated transaction record in `COMPLETED` state.
 * @throws {NotFoundError} If the transaction does not exist.
 * @throws {ForbiddenError} If the user does not own the transaction.
 * @throws {AppError} With code `'INVALID_STATE'` if the transaction is not PENDING.
 * @throws {AppError} With code `'PAYMENT_FAILED'` if the external payment fails.
 */
export async function confirmTransfer(transactionId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      fromAccount: true,
      toAccount: true,
    },
  })

  if (!tx) throw new NotFoundError('Transaction')

  // Ownership check: use toAccount when there's no fromAccount (stripe card-funding)
  const ownerUserId = tx.fromAccount ? tx.fromAccount.userId : tx.toAccount?.userId
  if (ownerUserId !== userId) throw new ForbiddenError('Access denied')

  if (tx.status !== 'PENDING') {
    throw new AppError(`Transaction is already ${tx.status.toLowerCase()}`, 400, 'INVALID_STATE')
  }
  if (!tx.toAccountId) throw new AppError('Invalid transaction accounts', 500)

  // Internal path — direct balance transfer, no external payment gateway
  if (tx.provider === 'internal') {
    if (!tx.fromAccountId) throw new AppError('Invalid transaction accounts', 500)
    const [updatedTx] = await prisma.$transaction([
      prisma.transaction.update({ where: { id: transactionId }, data: { status: 'COMPLETED' } }),
      prisma.account.update({
        where: { id: tx.fromAccountId },
        data: { balanceCents: { decrement: tx.amountCents } },
      }),
      prisma.account.update({
        where: { id: tx.toAccountId },
        data: { balanceCents: { increment: tx.amountCents } },
      }),
    ])
    return updatedTx
  }

  // Nymbus path
  if (tx.provider === 'nymbus') {
    if (!tx.fromAccountId) throw new AppError('Invalid transaction accounts', 500)
    const [updatedTx] = await prisma.$transaction([
      prisma.transaction.update({ where: { id: transactionId }, data: { status: 'COMPLETED' } }),
      prisma.account.update({ where: { id: tx.fromAccountId }, data: { balanceCents: { decrement: tx.amountCents } } }),
      prisma.account.update({ where: { id: tx.toAccountId! }, data: { balanceCents: { increment: tx.amountCents } } }),
    ])
    return updatedTx
  }

  // Moov path
  if (tx.moovTransferId) {
    if (!tx.fromAccountId) throw new AppError('Invalid transaction accounts', 500)
    const { status } = await moovGetTransfer(tx.moovTransferId)

    if (status !== 'completed') {
      // For Moov, a transfer is submitted asynchronously — treat non-failed as pending/processing
      if (status === 'failed') {
        await prisma.transaction.update({ where: { id: transactionId }, data: { status: 'FAILED' } })
        throw new AppError(`Moov transfer failed with status: ${status}`, 400, 'PAYMENT_FAILED')
      }
      // Transfer is in-flight — mark as completed optimistically (balance will be updated by webhook too)
    }

    const [updatedTx] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      }),
      prisma.account.update({
        where: { id: tx.fromAccountId },
        data: { balanceCents: { decrement: tx.amountCents } },
      }),
      prisma.account.update({
        where: { id: tx.toAccountId },
        data: { balanceCents: { increment: tx.amountCents } },
      }),
    ])

    return updatedTx
  }

  // Stripe path
  if (!tx.stripePaymentIntentId) throw new AppError('No payment intent associated', 500)

  const pi = await confirmPaymentIntent(tx.stripePaymentIntentId)

  if (pi.status !== 'succeeded') {
    await prisma.transaction.update({ where: { id: transactionId }, data: { status: 'FAILED' } })
    throw new AppError(`Payment failed with status: ${pi.status}`, 400, 'PAYMENT_FAILED')
  }

  // Stripe card-funding: only credit toAccount (no fromAccount to debit)
  if (!tx.fromAccountId) {
    const [updatedTx] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      }),
      prisma.account.update({
        where: { id: tx.toAccountId },
        data: { balanceCents: { increment: tx.amountCents } },
      }),
    ])
    return updatedTx
  }

  const [updatedTx] = await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED' },
    }),
    prisma.account.update({
      where: { id: tx.fromAccountId },
      data: { balanceCents: { decrement: tx.amountCents } },
    }),
    prisma.account.update({
      where: { id: tx.toAccountId },
      data: { balanceCents: { increment: tx.amountCents } },
    }),
  ])

  return updatedTx
}

/**
 * Cancels a PENDING transfer and revokes the associated external payment where possible.
 *
 * - **Moov** transfers: attempts `cancelTransfer`; swallows errors if past cancellable state.
 * - **Stripe** transfers: attempts `cancelPaymentIntent`; swallows errors if already cancelled.
 * - **Internal / Nymbus** transfers: no external call needed.
 *
 * @param transactionId - The transaction's primary key.
 * @param userId - The requesting user's ID (ownership check).
 * @returns The updated transaction record in `CANCELLED` state.
 * @throws {NotFoundError} If the transaction does not exist.
 * @throws {ForbiddenError} If the user does not own the transaction.
 * @throws {AppError} With code `'INVALID_STATE'` if the transaction is not PENDING.
 */
export async function cancelTransfer(transactionId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { fromAccount: true, toAccount: true },
  })

  if (!tx) throw new NotFoundError('Transaction')
  const ownerUserId = tx.fromAccount ? tx.fromAccount.userId : tx.toAccount?.userId
  if (ownerUserId !== userId) throw new ForbiddenError('Access denied')
  if (tx.status !== 'PENDING') {
    throw new AppError(`Cannot cancel a ${tx.status.toLowerCase()} transaction`, 400, 'INVALID_STATE')
  }

  if (tx.moovTransferId) {
    try {
      await moovCancelTransfer(tx.moovTransferId)
    } catch {
      // Already past cancellable state — continue
    }
  } else if (tx.provider !== 'internal' && tx.stripePaymentIntentId) {
    try {
      await cancelPaymentIntent(tx.stripePaymentIntentId)
    } catch {
      // Payment intent may already be cancelled — continue
    }
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'CANCELLED' },
  })
}

/**
 * Processes a Stripe webhook event for a PaymentIntent.
 *
 * Looks up the matching PENDING transaction by `piId`. On success,
 * atomically marks it COMPLETED and adjusts both account balances.
 * On failure, marks it FAILED. Silently returns if the transaction is
 * not found or already processed.
 *
 * @param piId - Stripe PaymentIntent ID from the webhook event.
 * @param eventType - The Stripe event type received.
 */
export async function handleStripeWebhook(
  piId: string,
  eventType: 'payment_intent.succeeded' | 'payment_intent.payment_failed',
) {
  const tx = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: piId, status: 'PENDING' },
  })

  if (!tx) return // already processed or not our transaction

  if (eventType === 'payment_intent.succeeded') {
    if (!tx.fromAccountId || !tx.toAccountId) return

    await prisma.$transaction([
      prisma.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } }),
      prisma.account.update({
        where: { id: tx.fromAccountId },
        data: { balanceCents: { decrement: tx.amountCents } },
      }),
      prisma.account.update({
        where: { id: tx.toAccountId },
        data: { balanceCents: { increment: tx.amountCents } },
      }),
    ])
  } else {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } })
  }
}

/**
 * Processes a Moov webhook event for a transfer.
 *
 * Looks up the matching PENDING transaction by `moovTransferId`. On
 * `'completed'`, atomically marks it COMPLETED and adjusts both account
 * balances. On `'failed'`, marks it FAILED. Silently returns if the
 * transaction is not found or already processed.
 *
 * @param moovTransferId - The Moov transfer ID from the webhook payload.
 * @param eventType - The Moov event type (`'completed'` or `'failed'`).
 */
export async function handleMoovWebhook(
  moovTransferId: string,
  eventType: 'completed' | 'failed',
) {
  const tx = await prisma.transaction.findFirst({
    where: { moovTransferId, status: 'PENDING' },
  })

  if (!tx) return // already processed or not our transaction

  if (eventType === 'completed') {
    if (!tx.fromAccountId || !tx.toAccountId) return

    await prisma.$transaction([
      prisma.transaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } }),
      prisma.account.update({
        where: { id: tx.fromAccountId },
        data: { balanceCents: { decrement: tx.amountCents } },
      }),
      prisma.account.update({
        where: { id: tx.toAccountId },
        data: { balanceCents: { increment: tx.amountCents } },
      }),
    ])
  } else {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } })
  }
}
