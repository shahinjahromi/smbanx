import { useCallback, useEffect, useState } from 'react'
import { fetchAccounts } from '../api/accounts'
import type { Account } from '../types'

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAccounts()
      setAccounts(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load accounts'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { accounts, loading, error, refetch: load }
}
