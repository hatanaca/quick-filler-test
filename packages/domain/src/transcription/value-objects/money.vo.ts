import { DomainError } from '../../shared/errors/domain.error.js'

const MONEY_CHARS_RE = /^[\d.,?]+$/

/**
 * Validates that a raw money string is in Brazilian format.
 * A '?' may replace any digit (per-character uncertainty).
 * A fully uncertain value ('????') is accepted — the extractor
 * keeps it rather than guessing.
 */
function isBrazilianMoney(raw: string): boolean {
  if (!MONEY_CHARS_RE.test(raw)) return false
  const withoutUncertainty = raw.replaceAll('?', '')
  if (withoutUncertainty === '') return true
  const digitsAndComma = withoutUncertainty.replaceAll('.', '')
  return /^\d+,\d{1,2}$/.test(digitsAndComma)
}

export class Money {
  private constructor(readonly raw: string) {}

  static from(raw: string): Money {
    if (!isBrazilianMoney(raw)) {
      throw new DomainError(
        `value em formato monetário inválido: "${raw}" (esperado formato brasileiro "2.389,77")`,
      )
    }
    return new Money(raw)
  }

  hasUncertainty(): boolean {
    return this.raw.includes('?')
  }

  toString(): string {
    return this.raw
  }
}
