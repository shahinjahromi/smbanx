export type AccountType = 'CHECKING' | 'SAVINGS' | 'BUSINESS'
export type TransactionType = 'DEBIT' | 'CREDIT'
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface Account {
  id: string
  userId: string
  accountNumber: string
  accountType: AccountType
  name: string
  balanceCents: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface TransactionAccount {
  id: string
  name: string
  accountNumber: string
}

export interface Transaction {
  id: string
  fromAccountId: string | null
  toAccountId: string | null
  amountCents: number
  type: TransactionType
  status: TransactionStatus
  memo: string | null
  stripePaymentIntentId: string | null
  moovTransferId: string | null
  provider: 'stripe' | 'moov' | null
  createdAt: string
  updatedAt: string
  fromAccount?: TransactionAccount | null
  toAccount?: TransactionAccount | null
}

export type MoovRailType = 'ach-standard' | 'ach-same-day' | 'rtp' | 'fund'

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface TransactionsResponse {
  transactions: Transaction[]
  pagination: Pagination
}

export interface AuthUser {
  userId: string
  email: string
}

export interface TransferFormData {
  fromAccountId: string
  toAccountId: string
  amountCents: number
  memo?: string
  provider?: 'stripe' | 'moov'
  moovRailType?: MoovRailType
}

export interface TransferResult {
  transaction: Transaction
  paymentIntentId: string
  clientSecret: string | null
}
