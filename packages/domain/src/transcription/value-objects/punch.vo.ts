import { DomainError } from '../../shared/errors/domain.error.js'

export const PunchKind = {
  IN: 'IN',
  OUT: 'OUT',
} as const

export type PunchKind = (typeof PunchKind)[keyof typeof PunchKind]

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface PunchInput {
  kind: string
  time_raw: string
  time_hhmm: string
}

export class Punch {
  readonly kind: PunchKind
  readonly time_raw: string
  readonly time_hhmm: string

  private constructor(input: PunchInput) {
    this.kind = input.kind as PunchKind
    this.time_raw = input.time_raw
    this.time_hhmm = input.time_hhmm
  }

  static from(input: PunchInput): Punch {
    if (input.kind !== PunchKind.IN && input.kind !== PunchKind.OUT) {
      throw new DomainError(`kind inválido: "${input.kind}" (esperado IN ou OUT)`)
    }
    if (!input.time_raw.trim()) {
      throw new DomainError('time_raw não pode ser vazio')
    }
    if (!HHMM_RE.test(input.time_hhmm) && !input.time_hhmm.includes('?')) {
      throw new DomainError(`time_hhmm fora do formato HH:MM 24h: "${input.time_hhmm}"`)
    }
    return new Punch(input)
  }

  hasUncertainty(): boolean {
    return this.time_raw.includes('?') || this.time_hhmm.includes('?')
  }
}
