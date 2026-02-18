import { prisma } from '../config/prisma'
import { createPaymentIntent, confirmPaymentIntent, cancelPaymentIntent } from './stripeService'
import {
  createTransfer as moovCreateTransfer,
  getTransfer as moovGetTransfer,
  cancelTransfer as moovCancelTransfer,
} from './moovService'
import { NotFoundError, ForbiddenError, AppError, ValidationError } from '../utils/errors'

type Provider = 'internal' | 'stripe' | 'moov'
type MoovRailType = 'ach-standard' | 'ach-same-day' | 'rtp' | 'fund'

export async function initiateTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amountCents: number,
  memo?: string,
  provider: Provider = 'stripe',
  moovRailType?: MoovRailType,
) {
  // Validate accounts
  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findUnique({ where: { id: fromAccountId } }),
    prisma.account.findUnique({ where: { id: toAccountId } }),
  ])

  if (!fromAccount) throw new NotFoundError('Source account')
  if (!toAccount) throw new NotFoundError('Destination account')
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
    const { transferId, status } = await moovCreateTransfer(
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

    return { transaction: debitTx, paymentIntentId: transferId, clientSecret: null }
  }

  // Stripe path (default)
  const pi = await createPaymentIntent(amountCents, fromAccount.currency, memo)

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

export async function confirmTransfer(transactionId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      fromAccount: true,
      toAccount: true,
    },
  })

  if (!tx) throw new NotFoundError('Transaction')
  if (tx.fromAccount?.userId !== userId) throw new ForbiddenError('Access denied')
  if (tx.status !== 'PENDING') {
    throw new AppError(`Transaction is already ${tx.status.toLowerCase()}`, 400, 'INVALID_STATE')
  }
  if (!tx.fromAccountId || !tx.toAccountId) throw new AppError('Invalid transaction accounts', 500)

  // Internal path — direct balance transfer, no external payment gateway
  if (tx.provider === 'internal') {
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

  // Moov path
  if (tx.moovTransferId) {
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

export async function cancelTransfer(transactionId: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { fromAccount: true },
  })

  if (!tx) throw new NotFoundError('Transaction')
  if (tx.fromAccount?.userId !== userId) throw new ForbiddenError('Access denied')
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
