import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/authenticate'
import { getCardsByUser, getCardById } from '../services/cardService'

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

export default router
