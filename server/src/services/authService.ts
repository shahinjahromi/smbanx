import { prisma } from '../config/prisma'
import { verifyPassword } from '../utils/password'
import { hashPassword } from '../utils/password'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt'
import {
  UnauthorizedError,
  NotFoundError,
} from '../utils/errors'
import bcrypt from 'bcryptjs'
import { addDays } from '../utils/dateUtils'

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) throw new UnauthorizedError('Invalid email or password')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new UnauthorizedError('Invalid email or password')

  return issueTokens(user.id, user.email)
}

export async function refreshTokens(rawRefreshToken: string) {
  let payload: { userId: string; tokenId: string }
  try {
    payload = verifyRefreshToken(rawRefreshToken)
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token')
  }

  const dbToken = await prisma.refreshToken.findUnique({ where: { id: payload.tokenId } })

  if (!dbToken || dbToken.revokedAt || new Date() > dbToken.expiresAt) {
    // Possible reuse — revoke all tokens for this user
    if (dbToken) {
      await prisma.refreshToken.updateMany({
        where: { userId: payload.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
    throw new UnauthorizedError('Refresh token reuse detected or expired')
  }

  // Rotate: revoke old token
  await prisma.refreshToken.update({
    where: { id: dbToken.id },
    data: { revokedAt: new Date() },
  })

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) throw new NotFoundError('User')

  return issueTokens(user.id, user.email)
}

export async function logoutUser(rawRefreshToken: string) {
  try {
    const payload = verifyRefreshToken(rawRefreshToken)
    await prisma.refreshToken.updateMany({
      where: { id: payload.tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  } catch {
    // Silently ignore invalid tokens on logout
  }
}

async function issueTokens(userId: string, email: string) {
  const expiresAt = addDays(new Date(), 7)

  // Create a DB record first to get the ID
  const dbToken = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: 'pending', // placeholder
      expiresAt,
    },
  })

  const refreshToken = signRefreshToken({ userId, tokenId: dbToken.id })
  const tokenHash = await bcrypt.hash(refreshToken, 10)

  // Update with real hash
  await prisma.refreshToken.update({
    where: { id: dbToken.id },
    data: { tokenHash },
  })

  const accessToken = signAccessToken({ userId, email })

  return { accessToken, refreshToken, expiresAt }
}
