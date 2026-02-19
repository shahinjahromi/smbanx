import { StatusBadge, TypeBadge } from '../ui/Badge'
import { formatCents } from '../../utils/currency'
import { formatDateTime } from '../../utils/date'
import { cn } from '../../utils/classnames'
import type { Transaction, Pagination } from '../../types'
import { Button } from '../ui/Button'

interface TransactionTableProps {
  transactions: Transaction[]
  pagination: Pagination
  loading: boolean
  onPageChange: (page: number) => void
}

export function TransactionTable({
  transactions,
  pagination,
  loading,
  onPageChange,
}: TransactionTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-400">No transactions found</p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="pb-3 pr-4">Date</th>
              <th className="pb-3 pr-4">Memo</th>
              <th className="pb-3 pr-4">From</th>
              <th className="pb-3 pr-4">To</th>
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                  {formatDateTime(tx.createdAt)}
                </td>
                <td className="py-3 pr-4 max-w-xs">
                  {tx.provider === 'card' && tx.merchantName ? (
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <p className="truncate text-gray-900">{tx.merchantName}</p>
                    </div>
                  ) : (
                    <p className="truncate text-gray-900">{tx.memo ?? '—'}</p>
                  )}
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {tx.fromAccount?.name ?? '—'}
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {tx.toAccount?.name ?? '—'}
                </td>
                <td className="py-3 pr-4">
                  <TypeBadge type={tx.type} />
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={tx.status} />
                </td>
                <td
                  className={cn(
                    'py-3 text-right font-semibold tabular-nums',
                    tx.type === 'CREDIT' ? 'text-green-600' : 'text-gray-900',
                  )}
                >
                  {tx.type === 'CREDIT' ? '+' : '-'}
                  {formatCents(tx.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
        <p>
          Showing {(pagination.page - 1) * pagination.limit + 1}–
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <span className="px-2">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
