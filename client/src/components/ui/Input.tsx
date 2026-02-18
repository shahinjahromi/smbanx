import React from 'react'
import { cn } from '../../utils/classnames'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export function Input({ label, error, helperText, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
          error
            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 bg-white',
          'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="text-xs text-gray-500">{helperText}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
          error ? 'border-red-400' : 'border-gray-300',
          'bg-white disabled:cursor-not-allowed disabled:bg-gray-100',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
