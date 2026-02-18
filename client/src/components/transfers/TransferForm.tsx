import { useState, useEffect } from 'react'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'
import { parseDollarsToCents } from '../../utils/currency'
import { fetchMoovDestinations } from '../../api/accounts'
import type { Account, MoovRailType } from '../../types'

interface TransferFormProps {
  accounts: Account[]
  onSubmit: (data: {
    fromAccountId: string
    toAccountId: string
    amountCents: number
    memo?: string
    provider: 'stripe' | 'moov'
    moovRailType?: MoovRailType
  }) => void
  loading: boolean
}

const moovRailOptions: { value: MoovRailType; label: string }[] = [
  { value: 'ach-standard', label: 'Standard ACH (1–2 business days)' },
  { value: 'ach-same-day', label: 'Same-Day ACH (same business day)' },
  { value: 'rtp', label: 'RTP — Real-Time (instant, where supported)' },
  { value: 'fund', label: 'Fund wallet (ACH debit → Moov wallet)' },
]

export function TransferForm({ accounts, onSubmit, loading }: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [provider, setProvider] = useState<'stripe' | 'moov'>('stripe')
  const [moovRailType, setMoovRailType] = useState<MoovRailType>('ach-standard')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [moovDestinations, setMoovDestinations] = useState<Account[]>([])

  useEffect(() => {
    if (provider === 'moov') {
      fetchMoovDestinations().then(setMoovDestinations).catch(() => setMoovDestinations([]))
    }
  }, [provider])

  function validate() {
    const errs: Record<string, string> = {}
    if (!fromAccountId) errs.from = 'Please select a source account'
    if (!toAccountId) errs.to = 'Please select a destination account'
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      errs.to = 'Destination must be different from source'
    }
    const cents = parseDollarsToCents(amount)
    if (!amount) errs.amount = 'Amount is required'
    else if (cents <= 0) errs.amount = 'Amount must be greater than $0'
    else if (cents > 1_000_000_00) errs.amount = 'Amount cannot exceed $1,000,000'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    onSubmit({
      fromAccountId,
      toAccountId,
      amountCents: parseDollarsToCents(amount),
      memo: memo.trim() || undefined,
      provider,
      moovRailType: provider === 'moov' ? moovRailType : undefined,
    })
  }

  const fromAccount = accounts.find((a) => a.id === fromAccountId)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Select
        label="From account"
        value={fromAccountId}
        onChange={(e) => setFromAccountId(e.target.value)}
        error={errors.from}
      >
        <option value="">Select source account...</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.accountNumber})
          </option>
        ))}
      </Select>

      <Select
        label="To account"
        value={toAccountId}
        onChange={(e) => setToAccountId(e.target.value)}
        error={errors.to}
      >
        <option value="">Select destination account...</option>
        {provider === 'moov' ? (
          moovDestinations.length === 0 ? (
            <option disabled value="">No Moov-enabled accounts available</option>
          ) : (
            moovDestinations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.accountNumber})
              </option>
            ))
          )
        ) : (
          accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.id === fromAccountId}>
              {a.name} ({a.accountNumber})
            </option>
          ))
        )}
      </Select>

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
          fromAccount
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

      {/* Payment method selection */}
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Payment method</span>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="provider"
              value="stripe"
              checked={provider === 'stripe'}
              onChange={() => { setProvider('stripe'); setToAccountId('') }}
              className="h-4 w-4 text-blue-600 border-gray-300"
            />
            <span className="text-sm text-gray-700">Stripe — Card (test mode)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="provider"
              value="moov"
              checked={provider === 'moov'}
              onChange={() => { setProvider('moov'); setToAccountId('') }}
              className="h-4 w-4 text-blue-600 border-gray-300"
            />
            <span className="text-sm text-gray-700">Moov — Bank Transfer</span>
          </label>
        </div>
      </div>

      {provider === 'moov' && (
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

      <Button type="submit" loading={loading} className="w-full">
        Review Transfer
      </Button>
    </form>
  )
}
