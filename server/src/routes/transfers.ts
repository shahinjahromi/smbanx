import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate'
import { validateBody } from '../middleware/validateBody'
import { initiateTransfer, confirmTransfer, cancelTransfer } from '../services/transferService'

const router = Router()

router.use(authenticate)

const transferSchema = z.object({
  fromAccountId: z.string().min(1).optional(),
  toAccountId: z.string().min(1),
  amountCents: z.number().int().positive(),
  memo: z.string().max(500).optional(),
  provider: z.enum(['internal', 'stripe', 'moov']).default('stripe'),
  moovRailType: z.enum(['ach-standard', 'ach-same-day', 'rtp', 'fund']).optional(),
  paymentMethodId: z.string().optional(),
})

router.post(
  '/',
  validateBody(transferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fromAccountId, toAccountId, amountCents, memo, provider, moovRailType, paymentMethodId } = req.body
      const result = await initiateTransfer(
        req.user!.userId,
        fromAccountId,
        toAccountId,
        amountCents,
        memo,
        provider,
        moovRailType,
        paymentMethodId,
      )
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  },
)

router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await confirmTransfer(req.params.id, req.user!.userId)
    res.json({ transaction: tx })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await cancelTransfer(req.params.id, req.user!.userId)
    res.json({ transaction: tx })
  } catch (err) {
    next(err)
  }
})

export default router
