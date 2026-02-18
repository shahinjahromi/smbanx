import { Router, Request, Response, NextFunction } from 'express'
import { constructWebhookEvent } from '../services/stripeService'
import { verifyWebhookSignature } from '../services/moovService'
import { handleStripeWebhook, handleMoovWebhook } from '../services/transferService'
import { env } from '../config/env'
import Stripe from 'stripe'

const router = Router()

// Note: raw body is required for Stripe signature verification.
// The route is mounted before express.json() or with a raw body parser override.
router.post('/stripe', async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'] as string

  if (!sig) {
    return res.status(400).json({ error: 'Missing Stripe-Signature header' })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    return res.status(400).json({ error: message })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      await handleStripeWebhook(pi.id, 'payment_intent.succeeded')
    } else if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent
      await handleStripeWebhook(pi.id, 'payment_intent.payment_failed')
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

router.post('/moov', async (req: Request, res: Response, next: NextFunction) => {
  const webhookSecret = env.MOOV_WEBHOOK_SECRET

  if (webhookSecret) {
    const valid = verifyWebhookSignature(req.body as Buffer, req.headers as Record<string, string | undefined>, webhookSecret)
    if (!valid) {
      return res.status(400).json({ error: 'Moov webhook signature verification failed' })
    }
  }

  try {
    const payload = JSON.parse((req.body as Buffer).toString())
    const { eventType, data } = payload

    if (eventType === 'transfer.completed') {
      await handleMoovWebhook(data?.transferID ?? data?.id, 'completed')
    } else if (eventType === 'transfer.failed') {
      await handleMoovWebhook(data?.transferID ?? data?.id, 'failed')
    }

    res.json({ received: true })
  } catch (err) {
    next(err)
  }
})

export default router
