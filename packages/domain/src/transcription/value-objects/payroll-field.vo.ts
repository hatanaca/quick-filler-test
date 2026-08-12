import { DomainError } from '../../shared/errors/domain.error.js'
import { Money } from './money.vo.js'

export interface PayrollFieldInput {
  code: string
  label: string
  reference: string
  value: string
}

export class PayrollField {
  readonly code: string
  readonly label: string
  readonly reference: string
  private readonly _money: Money

  private constructor(input: PayrollFieldInput, money: Money) {
    this.code = input.code
    this.label = input.label
    this.reference = input.reference
    this._money = money
  }

  static from(input: PayrollFieldInput): PayrollField {
    if (!input.label.trim()) {
      throw new DomainError('label não pode ser vazio')
    }
    return new PayrollField(input, Money.from(input.value))
  }

  /** Valor monetário em formato brasileiro, sempre string. */
  get value(): string {
    return this._money.toString()
  }

  hasUncertainty(): boolean {
    return (
      this.code.includes('?') ||
      this.label.includes('?') ||
      this.reference.includes('?') ||
      this._money.hasUncertainty()
    )
  }
}
