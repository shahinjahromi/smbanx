import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/authenticate'
import { getCardsByUser, getCardById, updateCardStatus } from '../services/cardService'

const router = Router()

router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = await getCardsByUser(req.user!.userId)
    res.json(cards)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const card = await getCardById(req.params.id, req.user!.userId)
    res.json(card)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({ status: z.enum(['ACTIVE', 'FROZEN']) }).safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid status. Must be ACTIVE or FROZEN.' })
      return
    }
    const card = await updateCardStatus(req.params.id, req.user!.userId, parsed.data.status)
    res.json({ card })
  } catch (err) {
    next(err)
  }
})

export default router
