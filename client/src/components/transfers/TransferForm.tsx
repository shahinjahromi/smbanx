import { useState, useEffect } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'
import { parseDollarsToCents } from '../../utils/currency'
import { fetchMoovDestinations } from '../../api/accounts'
import type { Account, MoovRailType } from '../../types'

type TransferType = 'internal' | 'stripe' | 'moov'

interface TransferFormProps {
  accounts: Account[]
  onSubmit: (data: {
    fromAccountId?: string
    toAccountId: string
    amountCents: number
    memo?: string
    provider: TransferType
    moovRailType?: MoovRailType
    fromAccountName?: string
    toAccountName: string
    paymentMethodId?: string
  }) => void
  loading: boolean
}

const moovRailOptions: { value: MoovRailType; label: string }[] = [
  { value: 'ach-standard', label: 'Standard ACH (1–2 business days)' },
  { value: 'ach-same-day', label: 'Same-Day ACH (same business day)' },
  { value: 'rtp', label: 'RTP — Real-Time (instant, where supported)' },
  { value: 'fund', label: 'Fund wallet (ACH debit → Moov wallet)' },
]

const tabs: { value: TransferType; label: string; description: string }[] = [
  { value: 'internal', label: 'My Accounts', description: 'Between your own accounts — instant, no fees' },
  { value: 'stripe', label: 'Fund via card', description: 'Charge a card and credit your account' },
  { value: 'moov', label: 'Moov', description: 'ACH, RTP bank transfer' },
]

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#111827',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
}

export function TransferForm({ accounts, onSubmit, loading }: TransferFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [transferType, setTransferType] = useState<TransferType>('internal')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [moovRailType, setMoovRailType] = useState<MoovRailType>('ach-standard')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [moovDestinations, setMoovDestinations] = useState<Account[]>([])
  const [cardError, setCardError] = useState<string | undefined>()

  useEffect(() => {
    if (transferType === 'moov') {
      fetchMoovDestinations().then(setMoovDestinations).catch(() => setMoovDestinations([]))
    }
    // Reset account selections when transfer type changes
    setFromAccountId('')
    setToAccountId('')
    setErrors({})
    setCardError(undefined)
  }, [transferType])

  // Accounts eligible as "From" source
  const fromOptions: Account[] =
    transferType === 'moov'
      ? accounts.filter((a) => a.moovPaymentMethodId)
      : accounts

  // Accounts eligible as "To" destination
  const toOptions: Account[] =
    transferType === 'moov'
      ? moovDestinations
      : accounts.filter((a) => a.id !== fromAccountId)

  function validate() {
    const errs: Record<string, string> = {}
    if (transferType !== 'stripe') {
      if (!fromAccountId) errs.from = 'Please select a source account'
    }
    if (!toAccountId) errs.to = 'Please select a destination account'
    if (transferType !== 'stripe' && fromAccountId && toAccountId && fromAccountId === toAccountId) {
      errs.to = 'Destination must be different from source'
    }
    const cents = parseDollarsToCents(amount)
    if (!amount) errs.amount = 'Amount is required'
    else if (cents <= 0) errs.amount = 'Amount must be greater than $0'
    else if (cents > 1_000_000_00) errs.amount = 'Amount cannot exceed $1,000,000'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})

    if (transferType === 'stripe') {
      if (!stripe || !elements) return
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) return

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (error) {
        setCardError(error.message)
        return
      }
      setCardError(undefined)

      const toAccount = accounts.find((a) => a.id === toAccountId)

      onSubmit({
        toAccountId,
        amountCents: parseDollarsToCents(amount),
        memo: memo.trim() || undefined,
        provider: 'stripe',
        fromAccountName: undefined,
        toAccountName: toAccount?.name ?? toAccountId,
        paymentMethodId: paymentMethod.id,
      })
      return
    }

    const fromAccount = fromOptions.find((a) => a.id === fromAccountId)
    const toAccount =
      transferType === 'moov'
        ? moovDestinations.find((a) => a.id === toAccountId)
        : accounts.find((a) => a.id === toAccountId)

    onSubmit({
      fromAccountId,
      toAccountId,
      amountCents: parseDollarsToCents(amount),
      memo: memo.trim() || undefined,
      provider: transferType,
      moovRailType: transferType === 'moov' ? moovRailType : undefined,
      fromAccountName: fromAccount?.name ?? fromAccountId,
      toAccountName: toAccount?.name ?? toAccountId,
    })
  }

  const fromAccount = fromOptions.find((a) => a.id === fromAccountId)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Transfer type tabs */}
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Transfer type</span>
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTransferType(tab.value)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                transferType === tab.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className="block text-xs text-current opacity-70 mt-0.5 leading-tight">
                {tab.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* From account — hidden for stripe card-funding */}
      {transferType !== 'stripe' && (
        <Select
          label="From account"
          value={fromAccountId}
          onChange={(e) => {
            setFromAccountId(e.target.value)
            // If same account was selected as To, clear it
            if (e.target.value === toAccountId) setToAccountId('')
          }}
          error={errors.from}
        >
          <option value="">Select source account...</option>
          {fromOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.accountNumber})
            </option>
          ))}
          {transferType === 'moov' && fromOptions.length === 0 && (
            <option disabled value="">
              No Moov-enabled accounts available
            </option>
          )}
        </Select>
      )}

      {/* To account */}
      <Select
        label={transferType === 'stripe' ? 'Account to credit' : 'To account'}
        value={toAccountId}
        onChange={(e) => setToAccountId(e.target.value)}
        error={errors.to}
      >
        <option value="">Select destination account...</option>
        {toOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.accountNumber})
          </option>
        ))}
        {transferType === 'moov' && toOptions.length === 0 && (
          <option disabled value="">
            No Moov-enabled destinations available
          </option>
        )}
      </Select>

      {/* Stripe card element */}
      {transferType === 'stripe' && (
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1.5">Card details</span>
          <div
            className={`rounded-lg border px-3 py-3 bg-white ${
              cardError ? 'border-red-500' : 'border-gray-300'
            } focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500`}
          >
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
          {cardError && <p className="mt-1 text-xs text-red-600">{cardError}</p>}
          <p className="mt-1.5 text-xs text-gray-400">
            Test card: <span className="font-mono select-all">4242 4242 4242 4242</span> · Exp: <span className="font-mono select-all">12/34</span> · CVC: <span className="font-mono select-all">123</span>
          </p>
        </div>
      )}

      {/* Moov rail type */}
      {transferType === 'moov' && (
        <Select
          label="Rail type"
          value={moovRailType}
          onChange={(e) => setMoovRailType(e.target.value as MoovRailType)}
        >
          {moovRailOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}

      <Input
        label="Amount (USD)"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={errors.amount}
        helperText={
          transferType !== 'stripe' && fromAccount
            ? `Available: $${(fromAccount.balanceCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : undefined
        }
      />

      <Input
        label="Memo (optional)"
        placeholder="What's this transfer for?"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        maxLength={500}
      />

      <Button type="submit" loading={loading} className="w-full">
        Review Transfer
      </Button>
    </form>
  )
}
