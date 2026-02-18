import api from './axios'
import type { Transaction, TransferResult, MoovRailType } from '../types'

export interface TransferPayload {
  fromAccountId: string
  toAccountId: string
  amountCents: number
  memo?: string
  provider?: 'internal' | 'stripe' | 'moov'
  moovRailType?: MoovRailType
}

export async function initiateTransfer(payload: TransferPayload): Promise<TransferResult> {
  const { data } = await api.post<TransferResult>('/transfers', payload)
  return data
}

export async function confirmTransfer(id: string): Promise<Transaction> {
  const { data } = await api.post<{ transaction: Transaction }>(`/transfers/${id}/confirm`)
  return data.transaction
}

export async function cancelTransfer(id: string): Promise<Transaction> {
  const { data } = await api.post<{ transaction: Transaction }>(`/transfers/${id}/cancel`)
  return data.transaction
}
