import { DomainError } from '../../shared/errors/domain.error.js'
import type { DayRecord } from './day-record.vo.js'

export interface PageCartaoPontoInput {
  page: number
  days: DayRecord[]
}

export class PageCartaoPonto {
  readonly page: number
  readonly days: readonly DayRecord[]

  private constructor(input: PageCartaoPontoInput) {
    this.page = input.page
    this.days = Object.freeze([...input.days])
  }

  static from(input: PageCartaoPontoInput): PageCartaoPonto {
    if (input.page < 1) {
      throw new DomainError(`page deve começar em 1, recebido: ${input.page}`)
    }
    return new PageCartaoPonto(input)
  }
}
