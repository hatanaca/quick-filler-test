import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import { PayrollField } from '../../value-objects/payroll-field.vo.js'
import { stripSign } from './money.js'

/** Competência: "referência 09/2010 MENSAL" (OCR tolerante a ruído). */
const RECIBO_COMPETENCIA_RE =
  /(?:refer[eê]ncia|compet[eê]ncia|per[ií]odo)?[^\d]*?(\d{1,2})\/(\d{4})\s+MENSAL/i

/** Par "descrição valor" — valor termina em `,dd` (tolerante a caixa do OCR). */
const RECIBO_PAIR_RE = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ. /()]*?)\s+(-?\d[\d.,]*,\d{2})/g

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

  for (const line of text.split('\n')) {
    for (const match of line.matchAll(RECIBO_PAIR_RE)) {
      const label = (match[1] ?? '').trim()
      const value = stripSign(match[2] ?? '')
      if (!label || !value) continue

      const base = RECIBO_BASES.find(([re]) => re.test(label))
      if (base) bases.push(PayrollBase.from({ label: base[1], value }))
      else fields.push(PayrollField.from({ code: '', label, reference: '', value }))
    }
  }

  return [PageHolerite.from({ page: pageIndex + 1, year, month, fields, bases })]
}
