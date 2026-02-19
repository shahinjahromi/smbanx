import api from './axios'
import type { Transaction, TransactionsResponse, TransactionType, TransactionStatus } from '../types'

export interface TransactionFilters {
  page?: number
  limit?: number
  search?: string
  type?: TransactionType
  status?: TransactionStatus
  from?: string
  to?: string
  accountId?: string
  cardId?: string
}

export async function fetchTransactions(filters: TransactionFilters = {}): Promise<TransactionsResponse> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })
  const { data } = await api.get<TransactionsResponse>(`/transactions?${params}`)
  return data
}

export async function fetchTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get<{ transaction: Transaction }>(`/transactions/${id}`)
  return data.transaction
}
