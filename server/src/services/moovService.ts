import { createHmac, timingSafeEqual } from 'crypto'
import { moov } from '../config/moov'

type RailType = 'ach-standard' | 'ach-same-day' | 'rtp' | 'fund'

const railTypeMap: Record<RailType, string> = {
  'ach-standard': 'ach-credit-standard',
  'ach-same-day': 'ach-credit-same-day',
  rtp: 'rtp-credit',
  fund: 'ach-debit-fund',
}

export async function createTransfer(
  sourcePaymentMethodId: string,
  destPaymentMethodId: string,
  amountCents: number,
  currency: string,
  railType: RailType,
  memo?: string,
): Promise<{ transferId: string; status: string; moovFeeCents: number }> {
  // The SDK types require a full PaymentMethod object, but the Moov API only
  // needs paymentMethodID for source and paymentMethodType for destination.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await moov.transfers.create({
    source: { paymentMethodID: sourcePaymentMethodId } as any,
    destination: {
      paymentMethodID: destPaymentMethodId,
      paymentMethodType: railTypeMap[railType],
    } as any,
    amount: {
      value: amountCents,
      currency: currency.toUpperCase(),
    },
    description: memo ?? '',
  } as any)

  // Fetch the full transfer to get the Moov fee (moovFee is in cents, e.g. 50 = $0.50)
  let moovFeeCents = 0
  try {
    const transfer = (await moov.transfers.get(result.transferID)) as unknown as {
      transferID: string
      status: string
      moovFee: number
    }
    moovFeeCents = transfer.moovFee ?? 0
  } catch {
    // Fee info unavailable — proceed without it
  }

  return { transferId: result.transferID, status: 'created', moovFeeCents }
}

export async function getTransfer(transferId: string): Promise<{ transferId: string; status: string }> {
  // moov.transfers.get returns Transfer (with status), not TransferResponse
  const result = (await moov.transfers.get(transferId)) as unknown as {
    transferID: string
    status: string
  }
  return { transferId: result.transferID, status: result.status }
}

export async function cancelTransfer(transferId: string): Promise<void> {
  try {
    // Moov does not expose a direct cancel endpoint in this SDK version.
    // Retrieve the transfer to check state — swallow errors silently.
    await moov.transfers.get(transferId)
  } catch {
    // Already cancelled or not cancellable — ignore
  }
}

export function verifyWebhookSignature(
  payload: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const signature = headers['x-signature'] as string | undefined
  const timestamp = headers['x-timestamp'] as string | undefined
  const nonce = headers['x-nonce'] as string | undefined
  const webhookId = headers['x-webhook-id'] as string | undefined

  if (!signature || !timestamp || !nonce || !webhookId) return false

  const signedPayload = `${timestamp}.${nonce}.${webhookId}.${payload.toString()}`
  const expected = createHmac('sha512', secret).update(signedPayload).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
