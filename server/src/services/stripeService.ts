import { stripe } from '../config/stripe'

/**
 * Creates a Stripe PaymentIntent in an unconfirmed state.
 *
 * @param amountCents - Amount to charge in the smallest currency unit (cents).
 * @param currency - ISO-4217 currency code (e.g. `'USD'`).
 * @param memo - Optional description stored in the PaymentIntent metadata.
 * @param paymentMethodId - Optional Stripe payment method ID to attach at creation.
 * @returns The newly created Stripe `PaymentIntent` object.
 */
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

/**
 * Confirms a Stripe PaymentIntent, triggering the charge.
 *
 * @param paymentIntentId - The ID of the PaymentIntent to confirm.
 * @param paymentMethodId - Optional payment method to use for confirmation.
 *   Defaults to `'pm_card_visa'` (Stripe test token).
 * @returns The confirmed Stripe `PaymentIntent` object.
 */
export async function confirmPaymentIntent(paymentIntentId: string, paymentMethodId?: string) {
  const method = paymentMethodId ?? 'pm_card_visa'
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: method,
  })
}

/**
 * Cancels a Stripe PaymentIntent that has not yet been captured.
 *
 * @param paymentIntentId - The ID of the PaymentIntent to cancel.
 * @returns The cancelled Stripe `PaymentIntent` object.
 */
export async function cancelPaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.cancel(paymentIntentId)
}

/**
 * Retrieves a Stripe PaymentIntent by ID.
 *
 * @param paymentIntentId - The ID of the PaymentIntent to retrieve.
 * @returns The Stripe `PaymentIntent` object.
 */
export async function retrievePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Constructs and verifies a Stripe webhook event from a raw request body
 * and signature header.
 *
 * @param payload - Raw request body buffer (must not be JSON-parsed first).
 * @param sig - Value of the `Stripe-Signature` request header.
 * @param secret - Webhook endpoint secret from the Stripe dashboard.
 * @returns A verified Stripe `Event` object.
 * @throws {Stripe.errors.StripeSignatureVerificationError} If the signature is invalid.
 */
export function constructWebhookEvent(payload: Buffer, sig: string, secret: string) {
  return stripe.webhooks.constructEvent(payload, sig, secret)
}
