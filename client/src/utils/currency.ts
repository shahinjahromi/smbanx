export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function parseDollarsToCents(dollars: string): number {
  const cleaned = dollars.replace(/[^0-9.]/g, '')
  const value = parseFloat(cleaned)
  if (isNaN(value)) return 0
  return Math.round(value * 100)
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}
