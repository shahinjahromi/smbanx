import { useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useCards } from '../hooks/useCards'
import { useTransactions } from '../hooks/useTransactions'
import { updateCardStatus } from '../api/cards'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TransactionTable } from '../components/transactions/TransactionTable'
import { TransactionFilters } from '../components/transactions/TransactionFilters'

export function CardPage() {
  const { id } = useParams<{ id: string }>()
  const { cards, loading: cardsLoading, refetch } = useCards()
  const card = cards.find((c) => c.id === id)

  const { transactions, pagination, filters, loading: txLoading, error: txError, updateFilters } =
    useTransactions({ cardId: id, limit: 20 })

  const [modal, setModal] = useState<'freeze' | 'unfreeze' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!card || !modal) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateCardStatus(card.id, modal === 'freeze' ? 'FROZEN' : 'ACTIVE')
      await refetch()
      setModal(null)
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? (err.response?.data?.error ?? err.message)
        : err instanceof Error ? err.message : 'Failed to update card status'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (cardsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!card) return <Navigate to="/dashboard" replace />

  const mm = String(card.expiryMonth).padStart(2, '0')
  const yy = String(card.expiryYear).slice(-2)
  const isFrozen = card.status === 'FROZEN'

  function openToggle() {
    setSaveError(null)
    setModal(isFrozen ? 'unfreeze' : 'freeze')
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </Link>

      {/* Card header */}
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Visual card tile (non-clickable) */}
          <div className="w-full sm:w-72 flex-shrink-0">
            <div
              className="relative w-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-lg"
              style={{ aspectRatio: '1.586 / 1' }}
            >
              <div className="flex items-center justify-between">
                <svg viewBox="0 0 34 26" className="h-7 w-10 text-yellow-300" fill="currentColor">
                  <rect x="0" y="0" width="34" height="26" rx="4" fill="currentColor" opacity="0.15" />
                  <rect x="0" y="0" width="34" height="26" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <line x1="0" y1="9" x2="34" y2="9" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="0" y1="17" x2="34" y2="17" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="12" y1="0" x2="12" y2="26" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="22" y1="0" x2="22" y2="26" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                <span className="text-sm font-bold tracking-widest text-white/80">VISA</span>
              </div>
              <div className="mt-4 font-mono text-lg font-semibold tracking-widest text-white/90">
                •••• •••• •••• {card.last4}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/50">Expires</p>
                  <p className="font-mono text-sm text-white/80">{mm}/{yy}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isFrozen ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
                  }`}
                >
                  {isFrozen ? 'Locked' : 'Unlocked'}
                </span>
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Card number</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-gray-900">Visa ••••{card.last4}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Expires</p>
              <p className="mt-0.5 font-mono text-sm text-gray-700">{mm}/{yy}</p>
            </div>

            {/* Lock toggle */}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Lock card</p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={openToggle}
                  disabled={saving}
                  role="switch"
                  aria-checked={isFrozen}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isFrozen
                      ? 'bg-red-500 focus:ring-red-400'
                      : 'bg-gray-200 focus:ring-blue-500'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isFrozen ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Lock icon */}
                <svg
                  className={`h-4 w-4 ${isFrozen ? 'text-red-500' : 'text-gray-400'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isFrozen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  )}
                </svg>

                <span className={`text-sm font-medium ${isFrozen ? 'text-red-600' : 'text-gray-700'}`}>
                  {isFrozen ? 'Locked' : 'Unlocked'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions */}
      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Card Transactions</h2>
        </div>
        <div className="mb-4">
          <TransactionFilters filters={filters} onUpdate={updateFilters} />
        </div>
        {txError ? (
          <p className="py-8 text-center text-sm text-red-600">{txError}</p>
        ) : (
          <TransactionTable
            transactions={transactions}
            pagination={pagination}
            loading={txLoading}
            onPageChange={(page) => updateFilters({ page })}
          />
        )}
      </Card>

      {/* Lock confirmation modal */}
      <Modal
        open={modal === 'freeze'}
        onClose={() => setModal(null)}
        title="Lock card?"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Locking your card will immediately decline all new purchases, ATM withdrawals, and online
          transactions. You can unlock it at any time.
        </p>
        {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={saving}>
            Lock card
          </Button>
        </div>
      </Modal>

      {/* Unlock confirmation modal */}
      <Modal
        open={modal === 'unfreeze'}
        onClose={() => setModal(null)}
        title="Unlock card?"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Your card will be reactivated and ready to use.
        </p>
        {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={saving}>
            Unlock card
          </Button>
        </div>
      </Modal>
    </div>
  )
}
