import jwt from 'jsonwebtoken'
import { env } from '../config/env'

/** Payload embedded in every access token. */
export interface AccessTokenPayload {
  userId: string
  email: string
}

/** Payload embedded in every refresh token. */
export interface RefreshTokenPayload {
  userId: string
  /** Corresponds to the `RefreshToken.id` DB row used for rotation checks. */
  tokenId: string
}

/**
 * Signs a short-lived access token (15-minute expiry).
 *
 * @param payload - `{ userId, email }` to embed in the token.
 * @returns Signed JWT string.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' })
}

/**
 * Verifies an access token and returns its decoded payload.
 *
 * @param token - JWT string to verify.
 * @returns Decoded {@link AccessTokenPayload}.
 * @throws {JsonWebTokenError} If the signature is invalid.
 * @throws {TokenExpiredError} If the token has expired.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
}

/**
 * Signs a long-lived refresh token (7-day expiry).
 *
 * @param payload - `{ userId, tokenId }` to embed in the token.
 * @returns Signed JWT string.
 */
export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}

/**
 * Verifies a refresh token and returns its decoded payload.
 *
 * @param token - JWT string to verify.
 * @returns Decoded {@link RefreshTokenPayload}.
 * @throws {JsonWebTokenError} If the signature is invalid.
 * @throws {TokenExpiredError} If the token has expired.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
}

/**
 * Decodes a JWT without verifying its signature or expiry.
 * Useful for extracting claims from a token that may already be invalid.
 *
 * @param token - Any JWT string.
 * @returns Decoded payload cast to `T`, or `null` if decoding fails.
 */
export function decodeToken<T>(token: string): T | null {
  try {
    return jwt.decode(token) as T
  } catch {
    return null
  }
}
