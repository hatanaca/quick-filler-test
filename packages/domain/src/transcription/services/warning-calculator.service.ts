import type { DayRecord } from '../value-objects/day-record.vo.js'
import type { PageHolerite } from '../value-objects/page-holerite.vo.js'

export const CartaoPontoWarningType = {
  ODD_PUNCHES: 'odd-punches',
  NON_SEQUENTIAL_DATE: 'non-sequential-date',
} as const

export type CartaoPontoWarningType =
  (typeof CartaoPontoWarningType)[keyof typeof CartaoPontoWarningType]

export const HoleriteWarningType = {
  EMPTY_PAGE: 'empty-page',
  NON_SEQUENTIAL_MONTH: 'non-sequential-month',
} as const

export type HoleriteWarningType = (typeof HoleriteWarningType)[keyof typeof HoleriteWarningType]

export interface DayWarning {
  index: number
  types: CartaoPontoWarningType[]
}

export interface PageWarning {
  page: number
  types: HoleriteWarningType[]
}

function isNextMonth(prevYear: number, prevMonth: number, year: number, month: number): boolean {
  if (month === prevMonth + 1 && year === prevYear) return true
  return prevMonth === 12 && month === 1 && year === prevYear + 1
}

/**
 * Avisos derivados do próprio dado — calculados na hora de exibir,
 * nunca armazenados. Datas/competências ilegíveis não quebram a cadeia:
 * comparam-se as próximas legíveis entre si.
 */
export const WarningCalculator = {
  cartaoPonto(days: DayRecord[]): DayWarning[] {
    const warnings: DayWarning[] = []
    let lastReadable: DayRecord | null = null

    days.forEach((day, index) => {
      const types: CartaoPontoWarningType[] = []
      if (day.isOddPunches()) types.push(CartaoPontoWarningType.ODD_PUNCHES)

      const current = day.isDateNonSequential(lastReadable)
      if (current) types.push(CartaoPontoWarningType.NON_SEQUENTIAL_DATE)

      if (types.length > 0) warnings.push({ index, types })

      if (!day.date_raw.includes('?')) lastReadable = day
    })

    return warnings
  },

  holerite(pages: PageHolerite[]): PageWarning[] {
    const warnings: PageWarning[] = []
    let lastReadable: { year: number; month: number } | null = null

    for (const page of pages) {
      const types: HoleriteWarningType[] = []
      if (page.isEmpty()) types.push(HoleriteWarningType.EMPTY_PAGE)

      const competenceReadable =
        !page.month.includes('?') && !page.year.includes('?')
      if (competenceReadable) {
        const year = Number(page.year)
        const month = Number(page.month)
        if (lastReadable !== null && !isNextMonth(lastReadable.year, lastReadable.month, year, month)) {
          types.push(HoleriteWarningType.NON_SEQUENTIAL_MONTH)
        }
        lastReadable = { year, month }
      }

      if (types.length > 0) warnings.push({ page: page.page, types })
    }

    return warnings
  },
}
