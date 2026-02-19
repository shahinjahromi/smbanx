import { env } from '../config/env'
import { AppError } from '../utils/errors'

const BASE_URL = env.MARQETA_BASE_URL ?? 'https://sandbox-api.marqeta.com/v3'
const APP_TOKEN = env.MARQETA_APP_TOKEN ?? ''
const ADMIN_TOKEN = env.MARQETA_ADMIN_TOKEN ?? ''
const CARD_PRODUCT_TOKEN = env.MARQETA_CARD_PRODUCT_TOKEN ?? ''
const FUNDING_SOURCE_TOKEN = env.MARQETA_FUNDING_SOURCE_TOKEN ?? 'sandbox_program_funding'

const authHeader = 'Basic ' + Buffer.from(`${APP_TOKEN}:${ADMIN_TOKEN}`).toString('base64')

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

export interface MarqetaUser {
  token: string
  active: boolean
  first_name: string
  last_name: string
  email: string
  status: string
}

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

export interface MarqetaBalance {
  availableCents: number
  ledgerCents: number
}

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

export interface MarqetaCard {
  token: string
  user_token: string
  last_four: string
  expiration: string   // MMYY format e.g. "0328"
  state: string
}

export async function createMarqetaCard(userToken: string): Promise<MarqetaCard> {
  return mq<MarqetaCard>('POST', '/cards?show_pan=false&show_cvv_number=false', {
    user_token: userToken,
    card_product_token: CARD_PRODUCT_TOKEN,
  })
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface MarqetaTransaction {
  token: string
  type: string
  state: string
  amount: number
  currency_code: string
  card_token: string
  user_token: string
}

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

export async function simulateReversal(originalTransactionToken: string): Promise<MarqetaTransaction> {
  const resp = await mq<{ transaction: MarqetaTransaction }>('POST', '/simulate/reversal', {
    original_transaction_token: originalTransactionToken,
  })
  return resp.transaction
}

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
