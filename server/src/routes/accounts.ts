import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/authenticate'
import { getAccountsByUser, getAccountById, getMoovDestinations, getNymbusDestinations } from '../services/accountService'

const router = Router()

router.use(authenticate)

router.get('/moov-destinations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await getMoovDestinations(req.user!.userId)
    res.json({ accounts })
  } catch (err) {
    next(err)
  }
})

router.get('/nymbus-destinations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destinations = await getNymbusDestinations(req.user!.userId)
    res.json({ destinations })
  } catch (err) {
    next(err)
  }
})

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await getAccountsByUser(req.user!.userId)
    res.json({ accounts })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await getAccountById(req.params.id, req.user!.userId)
    res.json({ account })
  } catch (err) {
    next(err)
  }
})

export default router
