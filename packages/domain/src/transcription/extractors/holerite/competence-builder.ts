import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import type { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import type { PayrollField } from '../../value-objects/payroll-field.vo.js'

interface CompetenceState {
  year: string
  month: string
  fields: PayrollField[]
  bases: PayrollBase[]
}

/**
 * Acumulador reutilizável para parsers de holerite com múltiplas competências
 * por página (Declaração Remuneração, Ficha Financeira). Cada nova competência
 * faz flush da anterior e cria um novo state.
 */
export function createCompetenceAccumulator(pageIndex: number) {
  const pages: PageHolerite[] = []
  let current: CompetenceState | null = null

  function flush(): void {
    if (current) {
      pages.push(
        PageHolerite.from({
          page: pageIndex + 1,
          year: current.year,
          month: current.month,
          fields: current.fields,
          bases: current.bases,
        }),
      )
    }
    current = null
  }

  function start(year: string, month: string): void {
    flush()
    current = { year, month, fields: [], bases: [] }
  }

  function getCurrent(): CompetenceState | null {
    return current
  }

  function getPages(): PageHolerite[] {
    flush()
    return pages
  }

  return { start, getCurrent, getPages }
}
