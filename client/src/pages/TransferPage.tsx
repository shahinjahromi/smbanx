import { useState } from 'react'
import { Card } from '../components/ui/Card'
import { TransferForm } from '../components/transfers/TransferForm'
import { ConfirmModal } from '../components/transfers/ConfirmModal'
import { useAccounts } from '../hooks/useAccounts'
import { useTransfer } from '../hooks/useTransfer'
import type { TransferPayload } from '../api/transfers'
import type { MoovRailType } from '../types'

export function TransferPage() {
  const { accounts, loading: accountsLoading, refetch } = useAccounts()
  const { step, pendingTransfer, completedTransaction, error, initiate, confirm, cancel, reset } =
    useTransfer()
  const [pendingRailType, setPendingRailType] = useState<MoovRailType | undefined>()

  async function handleFormSubmit(data: {
    fromAccountId: string
    toAccountId: string
    amountCents: number
    memo?: string
    provider: 'stripe' | 'moov'
    moovRailType?: MoovRailType
  }) {
    setPendingRailType(data.moovRailType)
    await initiate(data as TransferPayload)
  }

  async function handleConfirm() {
    await confirm()
    // Refresh balances after successful transfer
    refetch()
  }

  function handleReset() {
    setPendingRailType(undefined)
    reset()
  }

  const fromAccountName = pendingTransfer
    ? accounts.find((a) => a.id === pendingTransfer.transaction.fromAccountId)?.name
    : undefined

  const toAccountName = pendingTransfer
    ? accounts.find((a) => a.id === pendingTransfer.transaction.toAccountId)?.name
    : undefined

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
        ) : accounts.length < 2 ? (
          <p className="text-sm text-gray-500">
            You need at least two accounts to make a transfer.
          </p>
        ) : (
          <TransferForm
            accounts={accounts}
            onSubmit={handleFormSubmit}
            loading={step === 'confirming' && !pendingTransfer}
          />
        )}
      </Card>

      <ConfirmModal
        step={step}
        pendingTransfer={pendingTransfer}
        completedTransaction={completedTransaction}
        error={error}
        fromAccountName={fromAccountName}
        toAccountName={toAccountName}
        moovRailType={pendingRailType}
        onConfirm={handleConfirm}
        onCancel={cancel}
        onReset={handleReset}
      />
    </div>
  )
}
