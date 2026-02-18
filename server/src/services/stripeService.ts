import { stripe } from '../config/stripe'

export async function createPaymentIntent(amountCents: number, currency: string, memo?: string) {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    confirm: false,
    payment_method_types: ['card'],
    metadata: { memo: memo ?? '' },
  })
}

export async function confirmPaymentIntent(paymentIntentId: string) {
  // Use a Stripe test payment method for auto-confirmation in test mode
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: 'pm_card_visa',
  })
}

export async function cancelPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId)
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

export function constructWebhookEvent(payload: Buffer, sig: string, secret: string) {
  return stripe.webhooks.constructEvent(payload, sig, secret)
}
