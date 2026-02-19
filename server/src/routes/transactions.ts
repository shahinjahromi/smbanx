import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/authenticate'
import { getTransactions, getTransactionById } from '../services/transactionService'
import { TransactionStatus, TransactionType } from '@prisma/client'

const router = Router()

router.use(authenticate)

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page,
      limit,
      search,
      type,
      status,
      from,
      to,
      accountId,
      cardId,
    } = req.query as Record<string, string | undefined>

    const result = await getTransactions(req.user!.userId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      type: type as TransactionType | undefined,
      status: status as TransactionStatus | undefined,
      from,
      to,
      accountId,
      cardId,
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await getTransactionById(req.params.id, req.user!.userId)
    res.json({ transaction: tx })
  } catch (err) {
    next(err)
  }
})

export default router
