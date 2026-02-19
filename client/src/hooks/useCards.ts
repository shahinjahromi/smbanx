import { useCallback, useEffect, useState } from 'react'
import { fetchCards } from '../api/cards'
import type { Card } from '../types'

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCards()
      setCards(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load cards'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { cards, loading, error, refetch: load }
}
