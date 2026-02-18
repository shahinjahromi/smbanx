import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { loginUser, refreshTokens, logoutUser } from '../services/authService'
import { validateBody } from '../middleware/validateBody'
import { authLimiter } from '../middleware/rateLimiter'
import { env } from '../config/env'

const router = Router()

const REFRESH_COOKIE = 'refreshToken'
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body
      const { accessToken, refreshToken, expiresAt } = await loginUser(email, password)

      res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)

      res.json({
        accessToken,
        expiresAt,
      })
    } catch (err) {
      next(err)
    }
  },
)

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE]
    if (!rawRefreshToken) {
      return res.status(401).json({ error: 'No refresh token', code: 'UNAUTHORIZED' })
    }

    const { accessToken, refreshToken, expiresAt } = await refreshTokens(rawRefreshToken)

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)

    res.json({ accessToken, expiresAt })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE]
    if (rawRefreshToken) {
      await logoutUser(rawRefreshToken)
    }

    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production' })
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    next(err)
  }
})

export default router
