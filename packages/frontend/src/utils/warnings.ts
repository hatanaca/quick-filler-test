import type { CartaoPontoPage, DayRecord, HoleritePage } from '../types'

export type HighlightType = 'warning' | 'error'

export interface RowWarning {
  type: HighlightType
  reasons: string[]
}

const DAY_MS = 86_400_000

function parseDate(raw: string): { day: number; month: number; year: number } | null {
  if (raw.includes('?')) return null
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return { day, month, year }
}

export function cartaoRowWarning(
  day: DayRecord,
  prevReadable: DayRecord | null,
): RowWarning | null {
  const reasons: string[] = []
  if (day.punches.length % 2 === 1) reasons.push('Batidas ímpares')
  if (day.date_raw.includes('?')) reasons.push('Leitura incerta')
  if (day.punches.some((p) => p.time_raw.includes('?'))) reasons.push('Leitura incerta')

  let nonSequential = false
  if (prevReadable) {
    const current = parseDate(day.date_raw)
    const previous = parseDate(prevReadable.date_raw)
    if (current && previous) {
      const diff = Math.round(
        (Date.UTC(current.year, current.month - 1, current.day) -
          Date.UTC(previous.year, previous.month - 1, previous.day)) /
          DAY_MS,
      )
      if (diff !== 1) nonSequential = true
    }
  }
  if (nonSequential) reasons.push('Data não sequencial')

  if (reasons.length === 0) return null
  return { type: nonSequential ? 'error' : 'warning', reasons }
}

export function holeritePageWarning(
  page: HoleritePage,
  prevReadable: HoleritePage | null,
): RowWarning | null {
  const reasons: string[] = []
  if (page.fields.length === 0 && page.bases.length === 0) reasons.push('Página vazia')
  if (page.month.includes('?') || page.year.includes('?')) reasons.push('Leitura incerta')
  if (
    page.fields.some(
      (f) => f.value.includes('?') || f.label.includes('?') || f.reference.includes('?'),
    ) ||
    page.bases.some((b) => b.value.includes('?') || b.label.includes('?'))
  ) {
    reasons.push('Leitura incerta')
  }

  let nonSequential = false
  if (prevReadable && !page.month.includes('?') && !page.year.includes('?')) {
    const prevMonth = Number(prevReadable.month)
    const month = Number(page.month)
    const sameYear = page.year === prevReadable.year
    const nextYear = Number(page.year) === Number(prevReadable.year) + 1
    if (!(month === prevMonth + 1 && sameYear) && !(prevMonth === 12 && month === 1 && nextYear)) {
      nonSequential = true
    }
  }
  if (nonSequential) reasons.push('Mês não sequencial')

  if (reasons.length === 0) return null
  return { type: nonSequential ? 'error' : 'warning', reasons }
}

export function cartaoHeaders(maxPunches: number): string[] {
  const headers = ['Data']
  const pairs = Math.ceil(maxPunches / 2)
  for (let pair = 1; pair <= pairs; pair++) {
    headers.push(`Entrada ${pair}`, `Saída ${pair}`)
  }
  return headers
}

export function holeriteHeaders(pages: HoleritePage[]): string[] {
  const labels: string[] = []
  for (const page of pages) {
    for (const field of page.fields) {
      if (!labels.includes(field.label)) labels.push(field.label)
    }
  }
  return ['Pág.', 'Mês', 'Ano', ...labels]
}

export interface FlatCartaoRow {
  kind: 'cartao'
  cells: (string | null)[]
  warning: RowWarning | null
  day: DayRecord
}

export interface FlatHoleriteRow {
  kind: 'holerite'
  cells: (string | null)[]
  warning: RowWarning | null
  page: HoleritePage
}

export type FlatRow = FlatCartaoRow | FlatHoleriteRow

export function flattenCartao(pages: CartaoPontoPage[]): FlatCartaoRow[] {
  const days = pages.flatMap((page) => page.days)
  const headers = cartaoHeaders(Math.max(0, ...days.map((d) => d.punches.length)))
  const rows: FlatCartaoRow[] = []
  let prevReadable: DayRecord | null = null

  for (const day of days) {
    const cells: (string | null)[] = [day.date_raw, ...day.punches.map((p) => p.time_hhmm)]
    while (cells.length < headers.length) cells.push(null)
    rows.push({
      kind: 'cartao',
      cells,
      warning: cartaoRowWarning(day, prevReadable),
      day,
    })
    if (!day.date_raw.includes('?')) prevReadable = day
  }
  return rows
}

export function flattenHolerite(pages: HoleritePage[]): FlatHoleriteRow[] {
  const headers = holeriteHeaders(pages)
  const rows: FlatHoleriteRow[] = []
  let prevReadable: HoleritePage | null = null

  for (const page of pages) {
    const cells: (string | null)[] = [
      String(page.page),
      page.month,
      page.year,
      ...headers.slice(3).map((label) => page.fields.find((f) => f.label === label)?.value ?? null),
    ]
    rows.push({
      kind: 'holerite',
      cells,
      warning: holeritePageWarning(page, prevReadable),
      page,
    })
    if (!page.month.includes('?') && !page.year.includes('?')) prevReadable = page
  }
  return rows
}
