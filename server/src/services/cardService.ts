import { prisma } from '../config/prisma'
import { NotFoundError, ForbiddenError } from '../utils/errors'

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

export async function updateCardStatus(cardId: string, userId: string, status: 'ACTIVE' | 'FROZEN') {
  await getCardById(cardId, userId)
  return prisma.card.update({ where: { id: cardId }, data: { status } })
}
