import { useState } from 'react'
import { initiateTransfer, confirmTransfer, cancelTransfer } from '../api/transfers'
import type { TransferPayload } from '../api/transfers'
import type { Transaction, TransferResult } from '../types'

type TransferStep = 'idle' | 'confirming' | 'processing' | 'done' | 'error'

export function useTransfer() {
  const [step, setStep] = useState<TransferStep>('idle')
  const [pendingTransfer, setPendingTransfer] = useState<TransferResult | null>(null)
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function initiate(payload: TransferPayload) {
    setError(null)
    setStep('confirming')
    try {
      const result = await initiateTransfer(payload)
      setPendingTransfer(result)
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setError(msg)
      setStep('error')
    }
  }

  async function confirm() {
    if (!pendingTransfer) return
    setStep('processing')
    setError(null)
    try {
      const tx = await confirmTransfer(pendingTransfer.transaction.id)
      setCompletedTransaction(tx)
      setStep('done')
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      setError(msg)
      setStep('error')
    }
  }

  async function cancel() {
    if (!pendingTransfer) {
      reset()
      return
    }
    try {
      await cancelTransfer(pendingTransfer.transaction.id)
    } catch {
      // Ignore cancel errors
    }
    reset()
  }

  function reset() {
    setStep('idle')
    setPendingTransfer(null)
    setCompletedTransaction(null)
    setError(null)
  }

  return { step, pendingTransfer, completedTransaction, error, initiate, confirm, cancel, reset }
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    return response?.data?.error ?? 'An error occurred'
  }
  if (err instanceof Error) return err.message
  return 'An error occurred'
}
