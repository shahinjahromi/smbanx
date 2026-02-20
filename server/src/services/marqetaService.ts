import { env } from '../config/env'
import { AppError } from '../utils/errors'

const BASE_URL = env.MARQETA_BASE_URL ?? 'https://sandbox-api.marqeta.com/v3'
const APP_TOKEN = env.MARQETA_APP_TOKEN ?? ''
const ADMIN_TOKEN = env.MARQETA_ADMIN_TOKEN ?? ''
const CARD_PRODUCT_TOKEN = env.MARQETA_CARD_PRODUCT_TOKEN ?? ''
const FUNDING_SOURCE_TOKEN = env.MARQETA_FUNDING_SOURCE_TOKEN ?? 'sandbox_program_funding'

const authHeader = 'Basic ' + Buffer.from(`${APP_TOKEN}:${ADMIN_TOKEN}`).toString('base64')

/**
 * Internal HTTP helper for the Marqeta v3 REST API.
 * Parses the response as JSON and throws an {@link AppError} on non-2xx status.
 *
 * @template T - Expected shape of the successful response body.
 * @param method - HTTP method (e.g. `'GET'`, `'POST'`).
 * @param path - API path relative to `MARQETA_BASE_URL` (e.g. `'/users'`).
 * @param body - Optional request body (serialised to JSON).
 * @returns Parsed response body cast to `T`.
 * @throws {AppError} On non-2xx HTTP status or non-JSON response.
 */
async function mq<T>(method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new AppError(`Marqeta returned non-JSON: ${text}`, 502, 'MARQETA_ERROR')
  }

  if (!res.ok) {
    const err = json as { error_message?: string; error_code?: string }
    throw new AppError(
      err.error_message ?? `Marqeta error ${res.status}`,
      res.status === 409 ? 409 : 502,
      err.error_code ?? 'MARQETA_ERROR',
    )
  }

  return json as T
}

// ─── Users ───────────────────────────────────────────────────────────────────

/** Shape of a Marqeta user object. */
export interface MarqetaUser {
  token: string
  active: boolean
  first_name: string
  last_name: string
  email: string
  status: string
}

/**
 * Creates a new Marqeta cardholder user, or returns the existing one if the
 * token is already in use (idempotent via 409 handling).
 *
 * @param token - Unique user token (used as the Marqeta user identifier).
 * @param firstName - Cardholder first name.
 * @param lastName - Cardholder last name.
 * @param email - Cardholder email address.
 * @returns The created or existing {@link MarqetaUser}.
 * @throws {AppError} On unexpected Marqeta API errors.
 */
export async function createMarqetaUser(
  token: string,
  firstName: string,
  lastName: string,
  email: string,
): Promise<MarqetaUser> {
  try {
    return await mq<MarqetaUser>('POST', '/users', {
      token,
      first_name: firstName,
      last_name: lastName,
      email,
      active: true,
    })
  } catch (err) {
    // If user already exists (409), fetch and return it
    if (err instanceof AppError && err.statusCode === 409) {
      return mq<MarqetaUser>('GET', `/users/${token}`)
    }
    throw err
  }
}

// ─── GPA Funding ─────────────────────────────────────────────────────────────

/**
 * Credits a user's General Purpose Account (GPA) by the specified amount.
 *
 * @param userToken - The Marqeta user token to fund.
 * @param amountCents - Amount to credit in cents (converted to dollars internally).
 * @throws {AppError} If the Marqeta GPA order call fails.
 */
export async function fundGPA(userToken: string, amountCents: number): Promise<void> {
  const amount = amountCents / 100
  await mq('POST', '/gpaorders', {
    user_token: userToken,
    amount,
    currency_code: 'USD',
    funding_source_token: FUNDING_SOURCE_TOKEN,
  })
}

// ─── Balances ─────────────────────────────────────────────────────────────────

/** Live GPA balance figures returned by Marqeta. */
export interface MarqetaBalance {
  /** Spendable (available) balance in cents. */
  availableCents: number
  /** Posted (ledger) balance in cents. */
  ledgerCents: number
}

/**
 * Fetches the live GPA balance for a Marqeta user.
 *
 * @param userToken - The Marqeta user token.
 * @returns `{ availableCents, ledgerCents }` derived from the GPA balances.
 * @throws {AppError} If the Marqeta balance call fails.
 */
export async function getGPABalance(userToken: string): Promise<MarqetaBalance> {
  const resp = await mq<{ gpa: { available_balance: number; ledger_balance: number } }>(
    'GET',
    `/balances/${userToken}`,
  )
  return {
    availableCents: Math.round(resp.gpa.available_balance * 100),
    ledgerCents: Math.round(resp.gpa.ledger_balance * 100),
  }
}

// ─── Cards ───────────────────────────────────────────────────────────────────

/** Shape of a Marqeta card object. */
export interface MarqetaCard {
  token: string
  user_token: string
  last_four: string
  /** Card expiration in `MMYY` format, e.g. `'0328'`. */
  expiration: string
  state: string
}

/**
 * Issues a new virtual card for a Marqeta user using the configured
 * card product.
 *
 * @param userToken - The Marqeta user token to issue the card for.
 * @returns The newly created {@link MarqetaCard}.
 * @throws {AppError} If the Marqeta card creation call fails.
 */
export async function createMarqetaCard(userToken: string): Promise<MarqetaCard> {
  return mq<MarqetaCard>('POST', '/cards?show_pan=false&show_cvv_number=false', {
    user_token: userToken,
    card_product_token: CARD_PRODUCT_TOKEN,
  })
}

// ─── Simulation ──────────────────────────────────────────────────────────────

/** Shape of a Marqeta transaction simulation response. */
export interface MarqetaTransaction {
  token: string
  type: string
  state: string
  amount: number
  currency_code: string
  card_token: string
  user_token: string
}

/**
 * Simulates a card authorization (pending hold) via Marqeta.
 *
 * @param cardToken - The Marqeta card token to authorize against.
 * @param amountCents - Authorization amount in cents.
 * @param mid - Merchant ID string (alphanumeric/underscore, max 40 chars).
 * @returns The simulated {@link MarqetaTransaction} in `PENDING` state.
 * @throws {AppError} If the Marqeta simulation call fails.
 */
export async function simulateAuthorization(
  cardToken: string,
  amountCents: number,
  mid: string,
): Promise<MarqetaTransaction> {
  const resp = await mq<{ transaction: MarqetaTransaction }>('POST', '/simulate/authorization', {
    card_token: cardToken,
    amount: amountCents / 100,
    mid,
  })
  return resp.transaction
}

/**
 * Simulates clearing (settlement) of a previously authorized transaction.
 *
 * @param originalTransactionToken - Token of the authorization transaction to clear.
 * @param amountCents - Clearing amount in cents (may be less than or equal to auth amount).
 * @returns The simulated {@link MarqetaTransaction} in `CLEARED` state.
 * @throws {AppError} If the Marqeta simulation call fails.
 */
export async function simulateClearing(
  originalTransactionToken: string,
  amountCents: number,
): Promise<MarqetaTransaction> {
  const resp = await mq<{ transaction: MarqetaTransaction }>('POST', '/simulate/clearing', {
    original_transaction_token: originalTransactionToken,
    amount: amountCents / 100,
  })
  return resp.transaction
}

/**
 * Simulates reversal (void) of a previously authorized transaction.
 *
 * @param originalTransactionToken - Token of the authorization transaction to reverse.
 * @param amountCents - Reversal amount in cents.
 * @returns The simulated {@link MarqetaTransaction} reflecting the reversal.
 * @throws {AppError} If the Marqeta simulation call fails.
 */
export async function simulateReversal(
  originalTransactionToken: string,
  amountCents: number,
): Promise<MarqetaTransaction> {
  const resp = await mq<{ transaction: MarqetaTransaction }>('POST', '/simulate/reversal', {
    original_transaction_token: originalTransactionToken,
    amount: amountCents / 100,
  })
  return resp.transaction
}

/**
 * Simulates a financial (direct debit) transaction against a card's GPA,
 * typically used to drain a balance for testing purposes.
 *
 * @param cardToken - The Marqeta card token to debit.
 * @param amountCents - Amount to debit in cents.
 * @param mid - Merchant ID string (alphanumeric/underscore, max 40 chars).
 * @returns The simulated {@link MarqetaTransaction}.
 * @throws {AppError} If the Marqeta simulation call fails.
 */
export async function simulateFinancial(
  cardToken: string,
  amountCents: number,
  mid: string,
): Promise<MarqetaTransaction> {
  const resp = await mq<{ transaction: MarqetaTransaction }>('POST', '/simulate/financial', {
    card_token: cardToken,
    amount: amountCents / 100,
    mid,
  })
  return resp.transaction
}
