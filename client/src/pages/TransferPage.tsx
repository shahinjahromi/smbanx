import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Card } from '../components/ui/Card'
import { TransferForm } from '../components/transfers/TransferForm'
import { ConfirmModal } from '../components/transfers/ConfirmModal'
import { useAccounts } from '../hooks/useAccounts'
import { useTransfer } from '../hooks/useTransfer'
import type { TransferPayload } from '../api/transfers'
import type { MoovRailType } from '../types'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '')

export function TransferPage() {
  const { accounts, loading: accountsLoading, refetch } = useAccounts()
  const { step, pendingTransfer, completedTransaction, error, initiate, confirm, cancel, reset } =
    useTransfer()
  const [pendingRailType, setPendingRailType] = useState<MoovRailType | undefined>()
  const [pendingFromName, setPendingFromName] = useState<string | undefined>()
  const [pendingToName, setPendingToName] = useState<string | undefined>()

  async function handleFormSubmit(data: {
    fromAccountId?: string
    toAccountId: string
    amountCents: number
    memo?: string
    provider: 'internal' | 'stripe' | 'moov'
    moovRailType?: MoovRailType
    fromAccountName?: string
    toAccountName: string
    paymentMethodId?: string
  }) {
    setPendingRailType(data.moovRailType)
    setPendingFromName(data.fromAccountName)
    setPendingToName(data.toAccountName)
    const { fromAccountName: _f, toAccountName: _t, ...payload } = data
    await initiate(payload as TransferPayload)
  }

  async function handleConfirm() {
    await confirm()
    refetch()
  }

  function handleReset() {
    setPendingRailType(undefined)
    setPendingFromName(undefined)
    setPendingToName(undefined)
    reset()
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <h2 className="mb-5 text-lg font-semibold text-gray-900">New Transfer</h2>

        {accountsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500">You need at least one account to make a transfer.</p>
        ) : (
          <Elements stripe={stripePromise}>
            <TransferForm
              accounts={accounts}
              onSubmit={handleFormSubmit}
              loading={step === 'confirming' && !pendingTransfer}
            />
          </Elements>
        )}
      </Card>

      <ConfirmModal
        step={step}
        pendingTransfer={pendingTransfer}
        completedTransaction={completedTransaction}
        error={error}
        fromAccountName={pendingFromName}
        toAccountName={pendingToName}
        moovRailType={pendingRailType}
        onConfirm={handleConfirm}
        onCancel={cancel}
        onReset={handleReset}
      />
    </div>
  )
}
