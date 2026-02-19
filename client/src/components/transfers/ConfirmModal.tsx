import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { formatCents } from '../../utils/currency'
import type { TransferResult, Transaction, MoovRailType } from '../../types'

const moovRailLabels: Record<MoovRailType, string> = {
  'ach-standard': 'Standard ACH',
  'ach-same-day': 'Same-Day ACH',
  rtp: 'RTP (Real-Time)',
  fund: 'Fund wallet',
}

interface ConfirmModalProps {
  step: 'idle' | 'confirming' | 'processing' | 'done' | 'error'
  pendingTransfer: TransferResult | null
  completedTransaction: Transaction | null
  error: string | null
  fromAccountName?: string
  toAccountName?: string
  moovRailType?: MoovRailType
  onConfirm: () => void
  onCancel: () => void
  onReset: () => void
}

export function ConfirmModal({
  step,
  pendingTransfer,
  completedTransaction,
  error,
  fromAccountName,
  toAccountName,
  moovRailType,
  onConfirm,
  onCancel,
  onReset,
}: ConfirmModalProps) {
  const isOpen = step !== 'idle'

  function viaLabel(tx: Transaction): string {
    if (tx.provider === 'internal') return 'Internal transfer'
    if (tx.provider === 'moov' && moovRailType) {
      return `Moov — ${moovRailLabels[moovRailType]}`
    }
    if (tx.provider === 'moov') return 'Moov — Bank Transfer'
    return 'Card payment (Stripe)'
  }

  return (
    <Modal
      open={isOpen}
      onClose={step === 'done' || step === 'error' ? onReset : undefined}
      title={
        step === 'confirming'
          ? 'Confirm Transfer'
          : step === 'processing'
          ? 'Processing...'
          : step === 'done'
          ? 'Transfer Complete'
          : 'Transfer Failed'
      }
    >
      {step === 'confirming' && pendingTransfer && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 space-y-2">
            {fromAccountName != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">From</span>
                <span className="font-medium">{fromAccountName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">To</span>
              <span className="font-medium">{toAccountName ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Memo</span>
              <span className="font-medium">{pendingTransfer.transaction.memo ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Via</span>
              <span className="font-medium">{viaLabel(pendingTransfer.transaction)}</span>
            </div>
            {pendingTransfer.feeCents != null && pendingTransfer.feeCents > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Transfer amount</span>
                  <span className="font-medium">{formatCents(pendingTransfer.transaction.amountCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {moovRailType === 'rtp' ? 'RTP fee' : moovRailType === 'ach-same-day' ? 'Same-day ACH fee' : 'Processing fee'}
                  </span>
                  <span className="font-medium text-amber-700">+{formatCents(pendingTransfer.feeCents)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="font-bold text-gray-900">
                    {formatCents(pendingTransfer.transaction.amountCents + pendingTransfer.feeCents)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                <span className="font-semibold text-gray-700">Amount</span>
                <span className="font-bold text-gray-900">
                  {formatCents(pendingTransfer.transaction.amountCents)}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">
            This is a test mode transfer. No real money will move.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={onConfirm}>
              Confirm Transfer
            </Button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <svg className="h-12 w-12 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-600">Processing your transfer...</p>
        </div>
      )}

      {step === 'done' && completedTransaction && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {formatCents(completedTransaction.amountCents)} transferred
            </p>
            <p className="text-sm text-gray-500 mt-1">Your transfer was processed successfully.</p>
          </div>
          <Button className="w-full" onClick={onReset}>
            Make another transfer
          </Button>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900">Transfer Failed</p>
            <p className="text-sm text-red-600 mt-1">{error ?? 'An unexpected error occurred.'}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={onReset}>
            Try again
          </Button>
        </div>
      )}
    </Modal>
  )
}
