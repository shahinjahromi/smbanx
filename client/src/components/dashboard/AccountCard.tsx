import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { formatCents } from '../../utils/currency'
import type { Account, AccountType } from '../../types'

const accountTypeConfig: Record<AccountType, { label: string; color: string }> = {
  CHECKING: { label: 'Checking', color: 'text-blue-600' },
  SAVINGS: { label: 'Savings', color: 'text-green-600' },
  BUSINESS: { label: 'Business', color: 'text-purple-600' },
}

interface AccountCardProps {
  account: Account
}

export function AccountCard({ account }: AccountCardProps) {
  const { label, color } = accountTypeConfig[account.accountType]

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{account.name}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatCents(account.balanceCents, account.currency)}
          </p>
        </div>
        <Badge variant="default" className={color}>
          {label}
        </Badge>
      </div>
      {account.ledgerBalanceCents !== undefined && (
        <p className="text-xs text-gray-400 mt-1">
          Ledger: {formatCents(account.ledgerBalanceCents, account.currency)}
        </p>
      )}
      <p className="mt-3 font-mono text-xs text-gray-400">{account.accountNumber}</p>
    </Card>
  )
}
