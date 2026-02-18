import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
import { StatusBadge } from '../ui/Badge'
import { formatCents } from '../../utils/currency'
import { formatDate } from '../../utils/date'
import { cn } from '../../utils/classnames'
import type { Transaction } from '../../types'

interface RecentTransactionsProps {
  transactions: Transaction[]
  loading?: boolean
}

export function RecentTransactions({ transactions, loading }: RecentTransactionsProps) {
  return (
    <Card padding="none">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
        <Link to="/transactions" className="text-sm text-blue-600 hover:underline">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : transactions.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No transactions yet</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {tx.memo ?? (tx.type === 'CREDIT' ? 'Incoming Transfer' : 'Outgoing Transfer')}
                </p>
                <p className="text-xs text-gray-400">{formatDate(tx.createdAt)}</p>
              </div>
              <div className="ml-4 flex items-center gap-3">
                <StatusBadge status={tx.status} />
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    tx.type === 'CREDIT' ? 'text-green-600' : 'text-gray-900',
                  )}
                >
                  {tx.type === 'CREDIT' ? '+' : '-'}
                  {formatCents(tx.amountCents)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
