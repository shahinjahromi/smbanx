import React from 'react'
import { cn } from '../../utils/classnames'
import type { TransactionStatus, TransactionType } from '../../types'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-500',
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const config: Record<TransactionStatus, { variant: BadgeProps['variant']; label: string }> = {
    PENDING: { variant: 'warning', label: 'Pending' },
    COMPLETED: { variant: 'success', label: 'Completed' },
    FAILED: { variant: 'danger', label: 'Failed' },
    CANCELLED: { variant: 'neutral', label: 'Cancelled' },
  }
  const { variant, label } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function TypeBadge({ type }: { type: TransactionType }) {
  return type === 'CREDIT' ? (
    <Badge variant="success">Credit</Badge>
  ) : (
    <Badge variant="info">Debit</Badge>
  )
}
