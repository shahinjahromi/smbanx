import { env } from '../config/env'

function ny(path: string, options: RequestInit = {}) {
  const auth = Buffer.from(`${env.NYMBUS_USERNAME}:${env.NYMBUS_PASSWORD}`).toString('base64')
  return fetch(`${env.NYMBUS_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Prefer: 'code=200',
      ...(options.headers ?? {}),
    },
  })
}

// Returns { availableCents, currentCents }
export async function getNymbusAccountBalance(nymbusAccountId: string) {
  const res = await ny(`/v1.5/accounts/${nymbusAccountId}`)
  if (!res.ok) throw new Error(`Nymbus balance failed: ${res.status}`)
  const json = await res.json() as { availableBalance?: number; currentBalance?: number }
  return {
    availableCents: Math.round((json.availableBalance ?? 0) * 100),
    currentCents: Math.round((json.currentBalance ?? 0) * 100),
  }
}

// Creates a transfer; returns nymbusTransferId
export async function createNymbusTransfer(
  nymbusCustomerId: string,
  sourceAccountNumber: string,
  targetAccountNumber: string,
  amountDollars: number,
  description?: string,
) {
  const res = await ny(`/v1.1/customers/${nymbusCustomerId}/transfers/transfer`, {
    method: 'POST',
    body: JSON.stringify({ sourceAccountNumber, targetAccountNumber, amount: amountDollars, description }),
  })
  if (!res.ok) throw new Error(`Nymbus transfer failed: ${res.status}`)
  const json = await res.json() as { id?: string; transferId?: string }
  return json.id ?? json.transferId ?? 'nymbus-transfer-mock'
}
