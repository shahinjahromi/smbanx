import { stripe } from '../config/stripe'

export async function createPaymentIntent(amountCents: number, currency: string, memo?: string, paymentMethodId?: string) {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    confirm: false,
    payment_method_types: ['card'],
    metadata: { memo: memo ?? '' },
    ...(paymentMethodId ? { payment_method: paymentMethodId } : {}),
  })
}

export async function confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string) {
  const method = paymentMethodId ?? 'pm_card_visa'
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: method,
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
