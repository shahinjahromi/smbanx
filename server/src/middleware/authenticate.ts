import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { UnauthorizedError } from '../utils/errors'

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
      }
    }
  }
}

/**
 * Express middleware that authenticates incoming requests via a Bearer JWT.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the access
 * token, and attaches the decoded `{ userId, email }` to `req.user`.
 * Calls `next(UnauthorizedError)` on any failure so the global error
 * handler returns a structured 401 response.
 *
 * @param req - Express request object.
 * @param _res - Express response object (unused).
 * @param next - Express next function.
 * @throws {UnauthorizedError} If the Authorization header is missing, malformed,
 *   or the token is expired/invalid.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'))
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    req.user = { userId: payload.userId, email: payload.email }
    next()
  } catch {
    next(new UnauthorizedError('Access token expired or invalid'))
  }
}
