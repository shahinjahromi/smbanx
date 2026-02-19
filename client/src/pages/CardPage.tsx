import { useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
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
      setSaveError(err instanceof Error ? err.message : 'Failed to update card status')
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
                  {isFrozen ? 'Frozen' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Card number</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-gray-900">Visa ••••{card.last4}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Expires</p>
              <p className="mt-0.5 font-mono text-sm text-gray-700">{mm}/{yy}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isFrozen
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {isFrozen ? 'Frozen' : 'Active'}
              </span>
            </div>
            <div className="pt-1">
              {isFrozen ? (
                <Button variant="primary" onClick={() => { setSaveError(null); setModal('unfreeze') }}>
                  Unfreeze Card
                </Button>
              ) : (
                <Button variant="danger" onClick={() => { setSaveError(null); setModal('freeze') }}>
                  Freeze Card
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
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

      {/* Freeze modal */}
      <Modal
        open={modal === 'freeze'}
        onClose={() => setModal(null)}
        title="Freeze Card"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Freezing your card will immediately decline all new purchases, ATM withdrawals, and online
          transactions. You can unfreeze at any time.
        </p>
        {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={saving}>
            Freeze Card
          </Button>
        </div>
      </Modal>

      {/* Unfreeze modal */}
      <Modal
        open={modal === 'unfreeze'}
        onClose={() => setModal(null)}
        title="Unfreeze Card"
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
            Unfreeze Card
          </Button>
        </div>
      </Modal>
    </div>
  )
}
