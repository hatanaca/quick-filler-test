import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import { PayrollField } from '../../value-objects/payroll-field.vo.js'
import { SIGNED_MONEY_RE, stripSign } from './money.js'

/** Competência: "referência 09/2010 MENSAL" (OCR tolerante a ruído). */
const RECIBO_COMPETENCIA_RE = /\D*(\d{1,2})\/(\d{4})\s+MENSAL/i

/** Rótulos de base/total → nome canônico. */
const RECIBO_BASES: [RegExp, string][] = [
  [/total\s+de\s+proventos/i, 'Total Vencimentos'],
  [/total\s+de\s+descontos/i, 'Total Descontos'],
  [/l[ií]quido/i, 'Valor Líquido'],
  [/sal[aá]rio\s+base/i, 'Salário Base'],
  [/sal\.?\s+contrib\.?\s+inss/i, 'Base INSS'],
  [/base\s+c[aá]lc\.?\s+fgts/i, 'Base FGTS'],
  [/fgts\s+m[eê]s/i, 'FGTS'],
  [/base\s+c[aá]lc\.?\s+irrf/i, 'Base IR'],
]

/**
 * "Recibo de Pagamento" (escaneado/OCR): sem códigos de verba — cada linha é
 * "descrição valor" (Proventos à esquerda, Descontos à direita, fundidos pelo
 * OCR). Toda verba vira `fields` (code=""); totais e bases de cálculo viram
 * `bases`.
 */
export function parseReciboPagamento(text: string, pageIndex: number): PageHolerite[] {
  const competencia = RECIBO_COMPETENCIA_RE.exec(text)
  const month = competencia?.[1] ? String(Number(competencia[1])).padStart(2, '0') : '0?'
  const year = competencia?.[2] ?? '????'

  const fields: PayrollField[] = []
  const bases: PayrollBase[] = []

  // Parse label-value pairs without polynomial backtracking:
  // find all monetary values, then split the line at their boundaries.
  const moneyRe = new RegExp(SIGNED_MONEY_RE.source, 'g')

  for (const line of text.split('\n')) {
    const values: Array<{ start: number; end: number; raw: string }> = []
    for (const m of line.matchAll(moneyRe)) {
      values.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, raw: m[0] })
    }

    if (values.length === 0) continue

    // Pair each value with the text preceding it as label
    let prevEnd = 0
    for (const v of values) {
      const label = line.slice(prevEnd, v.start).trim()
      const value = stripSign(v.raw)
      prevEnd = v.end

      if (!label || !value) continue

      const base = RECIBO_BASES.find(([re]) => re.test(label))
      if (base) bases.push(PayrollBase.from({ label: base[1], value }))
      else fields.push(PayrollField.from({ code: '', label, reference: '', value }))
    }
  }

  return [PageHolerite.from({ page: pageIndex + 1, year, month, fields, bases })]
}
