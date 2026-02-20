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

/**
 * Authenticates a user with email and password and issues a token pair.
 *
 * @param email - The user's email address (case-insensitive).
 * @param password - The plain-text password to verify.
 * @returns `{ accessToken, refreshToken, expiresAt }` — the access token
 *   is short-lived (15 min); the refresh token is valid for 7 days and
 *   should be stored in an HttpOnly cookie.
 * @throws {UnauthorizedError} If the email does not exist or the password is wrong.
 */
export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) throw new UnauthorizedError('Invalid email or password')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new UnauthorizedError('Invalid email or password')

  return issueTokens(user.id, user.email)
}

/**
 * Rotates a refresh token: revokes the old token and issues a new pair.
 *
 * Implements refresh-token rotation — the supplied token is immediately
 * revoked after use. If the token has already been revoked (possible
 * reuse attack), **all** tokens for that user are revoked.
 *
 * @param rawRefreshToken - The raw refresh JWT from the HttpOnly cookie.
 * @returns `{ accessToken, refreshToken, expiresAt }` — fresh token pair.
 * @throws {UnauthorizedError} If the token is invalid, expired, or already revoked.
 */
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

/**
 * Revokes the supplied refresh token, effectively logging the user out.
 *
 * Silently ignores invalid or already-revoked tokens so that double-logout
 * calls do not surface errors to the client.
 *
 * @param rawRefreshToken - The raw refresh JWT from the HttpOnly cookie.
 */
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

/**
 * Creates a new refresh-token DB record and returns a signed token pair.
 * Uses a two-step write: the row is inserted first (to obtain its auto-ID),
 * then updated with the bcrypt hash of the signed JWT.
 *
 * @param userId - ID of the user to issue tokens for.
 * @param email - Email embedded in the access token payload.
 * @returns `{ accessToken, refreshToken, expiresAt }`.
 */
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
