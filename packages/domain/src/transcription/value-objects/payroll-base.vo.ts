import { DomainError } from '../../shared/errors/domain.error.js'
import { Money } from './money.vo.js'

export interface PayrollBaseInput {
  label: string
  value: string
}

export class PayrollBase {
  readonly label: string
  private readonly _money: Money

  private constructor(input: PayrollBaseInput, money: Money) {
    this.label = input.label
    this._money = money
  }

  static from(input: PayrollBaseInput): PayrollBase {
    if (!input.label.trim()) {
      throw new DomainError('label não pode ser vazio')
    }
    return new PayrollBase(input, Money.from(input.value))
  }

  /** Valor monetário em formato brasileiro, sempre string. */
  get value(): string {
    return this._money.toString()
  }

  hasUncertainty(): boolean {
    return this.label.includes('?') || this._money.hasUncertainty()
  }
}
