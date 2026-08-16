import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import { PayrollField } from '../../value-objects/payroll-field.vo.js'
import { cellsOf, lastMoney, splitCodeLabel, stripSign } from './money.js'

const PERIODO_RE = /Per[ií]odo\s*:\s*(\d{2})\/(\d{4})/

/** Rótulo de base no rodapé → nome canônico. Ordem importa (mais específico antes). */
const BASE_PATTERNS: [RegExp, string][] = [
  [/^Base\s+I\.?N\.?S\.?S\.?/i, 'Base INSS'],
  [/^Base\s+I\.?R\.?R\.?F\.?(?!\s*13)/i, 'Base IR'],
  [/^Base\s+FGTS/i, 'Base FGTS'],
  [/^F\.?G\.?T\.?S\.?/i, 'FGTS'],
]

function isNumber(value: string): boolean {
  return /^-?[\d.,?]+$/.test(value) && value !== ''
}

/**
 * "DEMONSTRATIVO DE PAGAMENTO MENSAL": código (4 dígitos ou "/314"/"/B02"),
 * colunas Unidade/Proventos/Descontos. O valor é o último monetário da linha
 * (Proventos ou Descontos); a referência é a Unidade quando presente.
 * Bases na seção inferior: Total (2 valores), Líqüido, Base I.N.S.S.,
 * F.G.T.S. do Mês, Base I.R.R.F., Base FGTS.
 */
export function parseDemonstrativo(text: string, pageIndex: number): PageHolerite[] {
  const competencia = PERIODO_RE.exec(text)
  const year = competencia?.[2] ?? '????'
  const month = competencia?.[1] ?? '0?'

  const fields: PayrollField[] = []
  const bases: PayrollBase[] = []
  let inVerbas = false

  for (const line of text.split('\n')) {
    const cells = cellsOf(line)
    if (cells.length === 0) continue
    const first = cells[0] ?? ''

    if (first.startsWith('Cod.') || first === 'Cod. Descrição') {
      inVerbas = true
      continue
    }

    if (first === 'Total') {
      const moneys = cells.slice(1).filter(isNumber)
      if (moneys.length >= 2) {
        bases.push(
          PayrollBase.from({ label: 'Total Vencimentos', value: stripSign(moneys[0] ?? '') }),
        )
        bases.push(
          PayrollBase.from({ label: 'Total Descontos', value: stripSign(moneys[1] ?? '') }),
        )
      }
      inVerbas = false
      continue
    }

    if (first === 'Líqüido' || first === 'Liquido') {
      const value = lastMoney(cells.join(' '))
      if (value) bases.push(PayrollBase.from({ label: 'Valor Líquido', value: stripSign(value) }))
      continue
    }

    if (inVerbas) {
      const { code, label } = splitCodeLabel(first)
      if (!label) continue
      const rest = cells.slice(1)
      if (rest.length === 0) continue
      const value = stripSign(rest[rest.length - 1] ?? '')
      const reference = rest.length > 1 ? stripSign(rest[rest.length - 2] ?? '') : ''
      if (value && isNumber(rest[rest.length - 1] ?? '')) {
        fields.push(PayrollField.from({ code, label, reference, value }))
      }
      continue
    }

    // Rodapé: "label : value", podendo haver mais de um par por linha
    // ("Base I.N.S.S. : 1.967,07  F.G.T.S. do Mês : 157,37"). O valor é a
    // próxima célula numérica após o rótulo (pulando ":").
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] ?? ''
      for (const [pattern, label] of BASE_PATTERNS) {
        if (!pattern.test(cell)) continue
        let j = i + 1
        while (j < cells.length && (cells[j] === ':' || !isNumber(cells[j] ?? ''))) j++
        const value = cells[j] ?? ''
        if (value) bases.push(PayrollBase.from({ label, value: stripSign(value) }))
        break
      }
    }
  }

  return [PageHolerite.from({ page: pageIndex + 1, year, month, fields, bases })]
}
