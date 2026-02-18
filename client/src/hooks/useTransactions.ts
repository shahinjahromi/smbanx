import { useCallback, useEffect, useState } from 'react'
import { fetchTransactions, TransactionFilters } from '../api/transactions'
import type { Transaction, Pagination } from '../types'

export function useTransactions(initialFilters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (f: TransactionFilters) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTransactions(f)
      setTransactions(data.transactions)
      setPagination(data.pagination)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load transactions'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters)
  }, [filters, load])

  const updateFilters = useCallback((updates: Partial<TransactionFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates, page: updates.page ?? 1 }))
  }, [])

  return {
    transactions,
    pagination,
    filters,
    loading,
    error,
    updateFilters,
    refetch: () => load(filters),
  }
}
