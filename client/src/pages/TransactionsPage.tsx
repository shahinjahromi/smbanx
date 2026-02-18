import { Card } from '../components/ui/Card'
import { TransactionFilters } from '../components/transactions/TransactionFilters'
import { TransactionTable } from '../components/transactions/TransactionTable'
import { useTransactions } from '../hooks/useTransactions'

export function TransactionsPage() {
  const { transactions, pagination, filters, loading, error, updateFilters } =
    useTransactions({ limit: 20 })

  return (
    <div className="space-y-5">
      <Card>
        <TransactionFilters filters={filters} onUpdate={updateFilters} />
      </Card>

      <Card padding="none">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {loading ? 'Loading...' : `${pagination.total} transaction${pagination.total !== 1 ? 's' : ''}`}
          </h2>
        </div>

        <div className="px-6 py-4">
          {error ? (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          ) : (
            <TransactionTable
              transactions={transactions}
              pagination={pagination}
              loading={loading}
              onPageChange={(page) => updateFilters({ page })}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
