import { useCallback, useEffect, useState } from 'react'
import { useCards } from '../hooks/useCards'
import { createCardTransaction, postCardTransaction, voidCardTransaction, fetchPendingAuths } from '../api/simulator'
import { parseDollarsToCents, formatCents } from '../utils/currency'
import { formatDateTime } from '../utils/date'
import type { PendingAuth } from '../api/simulator'

type TxType = 'auth' | 'purchase' | 'credit'

const TX_TYPES: { value: TxType; label: string; description: string }[] = [
  { value: 'auth', label: 'Authorization', description: 'Creates a pending hold (no balance change until posted)' },
  { value: 'purchase', label: 'Purchase', description: 'Immediate debit — settled instantly' },
  { value: 'credit', label: 'Credit / Refund', description: 'Immediate credit to account' },
]

export function CardSimulatorPage() {
  const { cards, loading: cardsLoading } = useCards()

  // Form state
  const [selectedCardId, setSelectedCardId] = useState('')
  const [txType, setTxType] = useState<TxType>('auth')
  const [merchantName, setMerchantName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pending auths
  const [pendingAuths, setPendingAuths] = useState<PendingAuth[]>([])
  const [authsLoading, setAuthsLoading] = useState(true)
  const [postingId, setPostingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)

  // Pre-select first card
  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0].id)
    }
  }, [cards, selectedCardId])

  const loadPendingAuths = useCallback(async () => {
    setAuthsLoading(true)
    try {
      const data = await fetchPendingAuths()
      setPendingAuths(data)
    } catch {
      // silent
    } finally {
      setAuthsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPendingAuths()
  }, [loadPendingAuths])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const amountCents = parseDollarsToCents(amountStr)
    if (amountCents <= 0) {
      setErrorMsg('Please enter a valid amount')
      return
    }
    if (!merchantName.trim()) {
      setErrorMsg('Merchant name is required')
      return
    }

    setSubmitting(true)
    try {
      await createCardTransaction({
        cardId: selectedCardId,
        type: txType,
        amountCents,
        merchantName: merchantName.trim(),
        memo: memo.trim() || undefined,
      })

      const typeLabel = txType === 'auth' ? 'Authorization' : txType === 'purchase' ? 'Purchase' : 'Credit'
      setSuccessMsg(`${typeLabel} of ${formatCents(amountCents)} created successfully`)
      setMerchantName('')
      setAmountStr('')
      setMemo('')
      await loadPendingAuths()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePost(txId: string) {
    setPostingId(txId)
    try {
      await postCardTransaction(txId)
      await loadPendingAuths()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to post transaction')
    } finally {
      setPostingId(null)
    }
  }

  async function handleVoid(txId: string) {
    setVoidingId(txId)
    try {
      await voidCardTransaction(txId)
      await loadPendingAuths()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to void authorization')
    } finally {
      setVoidingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Card Simulator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Simulate card transactions for demo purposes. Authorizations create pending holds; post them to settle.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left — Simulate Transaction */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Simulate Transaction</h2>

          {cardsLoading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : cards.length === 0 ? (
            <p className="text-sm text-gray-500">No cards found for your account.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Card selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Card</label>
                <select
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      Visa ••••{card.last4} — {card.account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transaction type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Transaction Type</label>
                <div className="space-y-2">
                  {TX_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        txType === t.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="txType"
                        value={t.value}
                        checked={txType === t.value}
                        onChange={() => setTxType(t.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{t.label}</p>
                        <p className="text-xs text-gray-500">{t.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Merchant name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Merchant Name</label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="e.g. Starbucks"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Memo <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {successMsg && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>
              )}
              {errorMsg && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Submit Transaction'}
              </button>
            </form>
          )}
        </div>

        {/* Right — Pending Authorizations */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Pending Authorizations</h2>
            <button
              onClick={loadPendingAuths}
              className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>

          {authsLoading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : pendingAuths.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-400">No pending authorizations</p>
              <p className="mt-1 text-xs text-gray-300">Submit an Authorization above to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAuths.map((auth) => (
                <div
                  key={auth.id}
                  className="rounded-lg border border-amber-100 bg-amber-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <p className="truncate text-sm font-medium text-gray-900">
                          {auth.merchantName ?? 'Unknown merchant'}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        ••••{auth.card?.last4 ?? '????'} · {auth.toAccount?.name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(auth.createdAt)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCents(auth.amountCents)}</p>
                      <span className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Pending
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handlePost(auth.id)}
                      disabled={postingId === auth.id || voidingId === auth.id}
                      className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {postingId === auth.id ? 'Posting...' : 'Post'}
                    </button>
                    <button
                      onClick={() => handleVoid(auth.id)}
                      disabled={postingId === auth.id || voidingId === auth.id}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      {voidingId === auth.id ? 'Voiding...' : 'Void'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
