import api from './axios'
import type { Transaction } from '../types'

export interface CardTransactionPayload {
  cardId: string
  type: 'auth' | 'purchase' | 'credit'
  amountCents: number
  merchantName: string
  memo?: string
}

export interface PendingAuth extends Transaction {
  card: { id: string; last4: string } | null
  toAccount: { id: string; name: string; accountNumber: string } | null
}

export async function createCardTransaction(payload: CardTransactionPayload): Promise<Transaction> {
  const { data } = await api.post<{ transaction: Transaction }>('/simulator/card-transaction', payload)
  return data.transaction
}

export async function postCardTransaction(txId: string): Promise<Transaction> {
  const { data } = await api.post<{ transaction: Transaction }>(`/simulator/card-transaction/${txId}/post`)
  return data.transaction
}

export async function fetchPendingAuths(): Promise<PendingAuth[]> {
  const { data } = await api.get<PendingAuth[]>('/simulator/pending-auths')
  return data
}
