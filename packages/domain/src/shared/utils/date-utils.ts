export interface ParsedDate {
  day: number
  month: number
  year: number
}

export type DateParseResult =
  | { status: 'readable'; date: ParsedDate }
  | { status: 'unreadable' }
  | { status: 'impossible' }

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/

/**
 * Parses a raw date as printed in the document (dd/mm/yyyy).
 *
 * - contains '?' or does not match the shape → unreadable
 * - impossible values (day > 31, month > 12, day/month zero) → impossible
 * - otherwise → readable
 *
 * An impossible date is an extraction error signal, never a real date.
 */
export function parseDateRaw(raw: string): DateParseResult {
  if (raw.includes('?')) return { status: 'unreadable' }

  const match = DATE_RE.exec(raw)
  if (!match) return { status: 'unreadable' }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    return { status: 'impossible' }
  }

  return { status: 'readable', date: { day, month, year } }
}

/**
 * Returns the difference in whole days between two parsed dates
 * (this - prev), using UTC to avoid timezone shifts.
 */
export function daysBetween(prev: ParsedDate, current: ParsedDate): number {
  const prevMs = Date.UTC(prev.year, prev.month - 1, prev.day)
  const currentMs = Date.UTC(current.year, current.month - 1, current.day)
  return Math.round((currentMs - prevMs) / 86_400_000)
}
