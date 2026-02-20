/**
 * Returns a new `Date` that is `days` days after `date`.
 *
 * @param date - The base date.
 * @param days - Number of days to add (use a negative value to subtract).
 * @returns A new `Date` instance; the original is not mutated.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Returns a new `Date` that is `days` days before `date`.
 *
 * @param date - The base date.
 * @param days - Number of days to subtract.
 * @returns A new `Date` instance; the original is not mutated.
 */
export function subDays(date: Date, days: number): Date {
  return addDays(date, -days)
}
