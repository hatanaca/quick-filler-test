import { DomainError } from '../../shared/errors/domain.error.js'
import type { PayrollField } from './payroll-field.vo.js'
import type { PayrollBase } from './payroll-base.vo.js'

const MONTH_RE = /^(0[1-9]|1[0-2])$/

export interface PageHoleriteInput {
  page: number
  year: string
  month: string
  fields: PayrollField[]
  bases: PayrollBase[]
}

export class PageHolerite {
  readonly page: number
  readonly year: string
  readonly month: string
  readonly fields: readonly PayrollField[]
  readonly bases: readonly PayrollBase[]

  private constructor(input: PageHoleriteInput) {
    this.page = input.page
    this.year = input.year
    this.month = input.month
    this.fields = Object.freeze([...input.fields])
    this.bases = Object.freeze([...input.bases])
  }

  static from(input: PageHoleriteInput): PageHolerite {
    if (input.page < 1) {
      throw new DomainError(`page deve começar em 1, recebido: ${input.page}`)
    }
    // Competência legível: "01" a "12" com zero à esquerda.
    // Competência incerta contém '?' e é aceita (não quebra a cadeia de sequência).
    if (!MONTH_RE.test(input.month) && !input.month.includes('?')) {
      throw new DomainError(
        `month deve ser "01" a "12" com zero à esquerda, recebido: "${input.month}"`,
      )
    }
    if (!/^\d{4}$/.test(input.year) && !input.year.includes('?')) {
      throw new DomainError(`year deve ter 4 dígitos, recebido: "${input.year}"`)
    }
    return new PageHolerite(input)
  }

  /** Warning derivado: a página existe no PDF mas nenhum dado saiu dela. */
  isEmpty(): boolean {
    return this.fields.length === 0 && this.bases.length === 0
  }

  hasUncertainty(): boolean {
    return (
      this.year.includes('?') ||
      this.month.includes('?') ||
      this.fields.some((f) => f.hasUncertainty()) ||
      this.bases.some((b) => b.hasUncertainty())
    )
  }
}
