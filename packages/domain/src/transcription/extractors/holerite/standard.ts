import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import { PayrollField } from '../../value-objects/payroll-field.vo.js'
import { SIGNED_MONEY_RE, lastMoney, moneyTokens, stripSign } from './money.js'

const COMPETENCIA_RE = /(?:Compet[eê]ncia|referente a)[:\s.]*(\d{2})\/(\d{4})/i
const FIELD_RE = /^(\d{4})\s+(\S.*)$/
const BASE_LABELS = [
  'Base INSS',
  'Base IR',
  'FGTS',
  'Total Vencimentos',
  'Total Descontos',
  'Valor Líquido',
  'Base FGTS',
  'Salário Contribuição',
]

/**
 * Layout padrão (PDFs sintéticos): competência "MM/YYYY", verba = código de 4
 * dígitos + descrição + referência + valor; bases em seção separada.
 */
export function parseStandard(text: string, pageIndex: number): PageHolerite[] {
  const competenceMatch = text.match(COMPETENCIA_RE)
  const year = competenceMatch?.[2] ?? '????'
  const rawMonth = competenceMatch?.[1] ?? '0?'
  const monthNum = Number(rawMonth)
  const month =
    rawMonth.includes('?') || (monthNum >= 1 && monthNum <= 12) ? rawMonth.padStart(2, '0') : '0?'

  const fields: PayrollField[] = []
  const bases: PayrollBase[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const baseLabel = BASE_LABELS.find((label) => trimmed.startsWith(label))
    if (baseLabel) {
      const value = lastMoney(trimmed)
      if (value) {
        bases.push(PayrollBase.from({ label: baseLabel, value: stripSign(value) }))
        continue
      }
    }

    const fieldMatch = trimmed.match(FIELD_RE)
    if (!fieldMatch) continue
    const rest = fieldMatch[2] ?? ''
    const moneys = moneyTokens(rest)
    if (moneys.length === 0) continue

    const value = stripSign(moneys[moneys.length - 1] ?? '')
    const reference = moneys.length > 1 ? stripSign(moneys[moneys.length - 2] ?? '') : ''

    const label = rest
      .replace(SIGNED_MONEY_RE, '')
      .replace(/-\s*$/, '')
      .trim()
      .replace(/\s{2,}/g, ' ')

    if (label) {
      fields.push(PayrollField.from({ code: fieldMatch[1] ?? '', label, reference, value }))
    }
  }

  return [PageHolerite.from({ page: pageIndex + 1, year, month, fields, bases })]
}
