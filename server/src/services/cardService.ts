import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'

/**
 * Returns all cards belonging to the given user, including the associated
 * account's name, number, and balance.
 *
 * @param userId - The authenticated user's ID.
 * @returns Array of card records with nested `account` fields, ordered by
 *   creation date ascending.
 */
export async function getCardsByUser(userId: string) {
  return prisma.card.findMany({
    where: { account: { userId } },
    include: {
      account: {
        select: { id: true, name: true, accountNumber: true, balanceCents: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Fetches a single card by ID and enforces ownership.
 *
 * @param cardId - The card's primary key.
 * @param userId - The requesting user's ID.
 * @returns The card record with nested account details (including `userId`
 *   for the ownership check).
 * @throws {NotFoundError} If no card with `cardId` exists.
 * @throws {ForbiddenError} If the card's account belongs to a different user.
 */
export async function getCardById(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      account: {
        select: { id: true, name: true, accountNumber: true, balanceCents: true, userId: true },
      },
    },
  })

  if (!card) throw new NotFoundError('Card')
  if (card.account.userId !== userId) throw new ForbiddenError('Access denied')

  return card
}

/**
 * Updates the lock status of a card after verifying ownership.
 *
 * @param cardId - The card's primary key.
 * @param userId - The requesting user's ID.
 * @param status - New card status: `'ACTIVE'` to unlock or `'FROZEN'` to lock.
 * @returns The updated card record.
 * @throws {NotFoundError} If no card with `cardId` exists.
 * @throws {ForbiddenError} If the card's account belongs to a different user.
 */
export async function updateCardStatus(cardId: string, userId: string, status: 'ACTIVE' | 'FROZEN') {
  await getCardById(cardId, userId)
  return prisma.card.update({ where: { id: cardId }, data: { status } })
}
