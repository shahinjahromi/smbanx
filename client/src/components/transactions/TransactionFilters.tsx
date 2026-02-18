import { useState } from 'react'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'
import type { TransactionFilters as Filters } from '../../api/transactions'
import type { TransactionStatus, TransactionType } from '../../types'

interface TransactionFiltersProps {
  filters: Filters
  onUpdate: (updates: Partial<Filters>) => void
}

export function TransactionFilters({ filters, onUpdate }: TransactionFiltersProps) {
  const [search, setSearch] = useState(filters.search ?? '')

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    onUpdate({ search, page: 1 })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form onSubmit={handleSearchSubmit} className="flex items-end gap-2">
        <Input
          label="Search"
          placeholder="Search memo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      <Select
        label="Type"
        value={filters.type ?? ''}
        onChange={(e) => onUpdate({ type: (e.target.value as TransactionType) || undefined, page: 1 })}
        className="w-36"
      >
        <option value="">All types</option>
        <option value="DEBIT">Debit</option>
        <option value="CREDIT">Credit</option>
      </Select>

      <Select
        label="Status"
        value={filters.status ?? ''}
        onChange={(e) => onUpdate({ status: (e.target.value as TransactionStatus) || undefined, page: 1 })}
        className="w-36"
      >
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="COMPLETED">Completed</option>
        <option value="FAILED">Failed</option>
        <option value="CANCELLED">Cancelled</option>
      </Select>

      <Input
        label="From date"
        type="date"
        value={filters.from ?? ''}
        onChange={(e) => onUpdate({ from: e.target.value || undefined, page: 1 })}
        className="w-40"
      />

      <Input
        label="To date"
        type="date"
        value={filters.to ?? ''}
        onChange={(e) => onUpdate({ to: e.target.value || undefined, page: 1 })}
        className="w-40"
      />

      {(filters.search || filters.type || filters.status || filters.from || filters.to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('')
            onUpdate({ search: undefined, type: undefined, status: undefined, from: undefined, to: undefined, page: 1 })
          }}
          className="self-end"
        >
          Clear
        </Button>
      )}
    </div>
  )
}
