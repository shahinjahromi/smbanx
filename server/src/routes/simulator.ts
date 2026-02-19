import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate'
import { validateBody } from '../middleware/validateBody'
import { createCardTransaction, postCardTransaction, getPendingAuths } from '../services/simulatorService'

const router = Router()

router.use(authenticate)

const cardTxSchema = z.object({
  cardId: z.string().min(1),
  type: z.enum(['auth', 'purchase', 'credit']),
  amountCents: z.number().int().positive(),
  merchantName: z.string().min(1).max(200),
  memo: z.string().max(500).optional(),
})

router.post(
  '/card-transaction',
  validateBody(cardTxSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId, type, amountCents, merchantName, memo } = req.body
      const tx = await createCardTransaction(cardId, req.user!.userId, type, amountCents, merchantName, memo)
      res.status(201).json({ transaction: tx })
    } catch (err) {
      next(err)
    }
  },
)

router.post('/card-transaction/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await postCardTransaction(req.params.id, req.user!.userId)
    res.json({ transaction: tx })
  } catch (err) {
    next(err)
  }
})

router.get('/pending-auths', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auths = await getPendingAuths(req.user!.userId)
    res.json(auths)
  } catch (err) {
    next(err)
  }
})

export default router
