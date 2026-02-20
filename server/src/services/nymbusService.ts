import { env } from '../config/env'

/**
 * Internal HTTP helper for the Nymbus Core Banking API (Stoplight Prism mock).
 * Attaches Basic-auth credentials and the `Prefer: code=200` header required
 * to force the Prism mock server to return a successful example response.
 *
 * @param path - API path relative to `NYMBUS_BASE_URL` (e.g. `'/v1.5/accounts/123'`).
 * @param options - Optional `fetch` init options (method, body, additional headers).
 * @returns Raw `fetch` Response; the caller is responsible for checking `res.ok`.
 */
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

/**
 * Fetches the live available and current balances for a Nymbus account.
 *
 * Calls `GET /v1.5/accounts/{accountId}` on the Nymbus API and converts
 * the dollar amounts to cents.
 *
 * @param nymbusAccountId - The Nymbus account identifier (e.g. `'5001001001'`).
 * @returns `{ availableCents, currentCents }` — both converted from the API's
 *   dollar-denominated `availableBalance` and `currentBalance` fields.
 * @throws {Error} If the Nymbus API returns a non-2xx status.
 */
export async function getNymbusAccountBalance(nymbusAccountId: string) {
  const res = await ny(`/v1.5/accounts/${nymbusAccountId}`)
  if (!res.ok) throw new Error(`Nymbus balance failed: ${res.status}`)
  const json = await res.json() as { availableBalance?: number; currentBalance?: number }
  return {
    availableCents: Math.round((json.availableBalance ?? 0) * 100),
    currentCents: Math.round((json.currentBalance ?? 0) * 100),
  }
}

/**
 * Initiates a transfer between two Nymbus accounts.
 *
 * Calls `POST /v1.1/customers/{customerId}/transfers/transfer`. Because the
 * Nymbus mock is stateless, the returned transfer ID may be the same across
 * calls; the `nymbusTransferId` column therefore has no unique constraint.
 *
 * @param nymbusCustomerId - Nymbus customer ID of the sender (e.g. `'nymbus-carol-001'`).
 * @param sourceAccountNumber - Nymbus account number of the source account.
 * @param targetAccountNumber - Nymbus account number of the destination account.
 * @param amountDollars - Transfer amount in dollars (Nymbus API is dollar-denominated).
 * @param description - Optional transfer description / memo.
 * @returns The Nymbus transfer ID string. Falls back to `'nymbus-transfer-mock'`
 *   if the mock response does not include an ID.
 * @throws {Error} If the Nymbus API returns a non-2xx status.
 */
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
