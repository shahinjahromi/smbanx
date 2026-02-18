import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { AccountCard } from '../components/dashboard/AccountCard'
import { RecentTransactions } from '../components/dashboard/RecentTransactions'
import { formatCents } from '../utils/currency'

export function DashboardPage() {
  const { email } = useAuth()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { transactions, loading: txLoading } = useTransactions({ limit: 10 })

  const totalBalance = accounts.reduce((sum, a) => sum + a.balanceCents, 0)
  const firstName = (email?.split('@')[0] ?? 'there').replace(/^./, (c) => c.toUpperCase())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Good morning, {firstName}!
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Here's an overview of your business accounts.
        </p>
      </div>

      {/* Total balance banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-blue-100">Total Balance</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">
          {accountsLoading ? '—' : formatCents(totalBalance)}
        </p>
        <p className="mt-2 text-sm text-blue-200">Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Account cards */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-gray-900">Your Accounts</h3>
        {accountsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <RecentTransactions transactions={transactions} loading={txLoading} />
    </div>
  )
}
