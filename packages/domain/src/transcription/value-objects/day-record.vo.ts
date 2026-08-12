import { DomainError } from '../../shared/errors/domain.error.js'
import { parseDateRaw, daysBetween } from '../../shared/utils/date-utils.js'
import type { Punch } from './punch.vo.js'

export interface DayRecordInput {
  date_raw: string
  punches: Punch[]
}

export class DayRecord {
  readonly date_raw: string
  readonly punches: readonly Punch[]

  private constructor(input: DayRecordInput) {
    this.date_raw = input.date_raw
    this.punches = Object.freeze([...input.punches])
  }

  static from(input: DayRecordInput): DayRecord {
    if (!input.date_raw.trim()) {
      throw new DomainError('date_raw não pode ser vazio')
    }
    return new DayRecord(input)
  }

  /** Warning derivado: dia com número ímpar de batidas (falta entrada ou saída). */
  isOddPunches(): boolean {
    return this.punches.length % 2 === 1
  }

  /**
   * Warning derivado: a data quebra a sequência do documento.
   * Datas ilegíveis ('?') não quebram a cadeia; datas impossíveis (38/07) sim.
   */
  isDateNonSequential(prev: DayRecord | null): boolean {
    if (prev === null) return false
    const current = parseDateRaw(this.date_raw)
    if (current.status === 'unreadable') return false
    if (current.status === 'impossible') return true
    const previous = parseDateRaw(prev.date_raw)
    if (previous.status !== 'readable') return false
    return daysBetween(previous.date, current.date) !== 1
  }

  hasUncertainty(): boolean {
    return this.date_raw.includes('?') || this.punches.some((p) => p.hasUncertainty())
  }
}
