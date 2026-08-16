import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import { PayrollField } from '../../value-objects/payroll-field.vo.js'
import { cellsOf, stripSign } from './money.js'

const MES_ANO_RE = /M[eê]s\/Ano\s*:\s*(\d{2})\/(\d{4})/

/** Bases do rodapé: "Proventos Bruto: 6.188,63", "Provisão FGTS: 495,09", ... */
const BASE_LABEL_RE =
  /(Proventos\s+Bruto|Proventos\s+L[ií]quidos|Provis[aã]o\s+FGTS)\s*:\s*(-?[\d.,?]+)/g

/**
 * "Declaração Remuneração - Folha de Pagamento": código de 3 dígitos, colunas
 * Verba | Nome | Base / Saldo / Benefício | Valor. Cada seção "Mês/Ano" (MÊS
 * ou ACERTO) vira uma entrada (compartilhando o mesmo `page`). O Valor pode
 * ser negativo (desconto); a Base pode ser texto ("JULHO/18") ou valor.
 */
export function parseDeclaracaoRemuneracao(text: string, pageIndex: number): PageHolerite[] {
  const pages: PageHolerite[] = []
  let current: {
    year: string
    month: string
    fields: PayrollField[]
    bases: PayrollBase[]
  } | null = null

  const flush = () => {
    if (current) {
      pages.push(
        PageHolerite.from({
          page: pageIndex + 1,
          year: current.year,
          month: current.month,
          fields: current.fields,
          bases: current.bases,
        }),
      )
    }
    current = null
  }

  for (const line of text.split('\n')) {
    const cells = cellsOf(line)
    if (cells.length === 0) continue
    const first = cells[0] ?? ''

    // Nova seção (MÊS / ACERTO) — cada uma tem seu próprio Mês/Ano.
    const mesAno = MES_ANO_RE.exec(line)
    if (mesAno && /Folha de Pagamento/i.test(line)) {
      flush()
      current = {
        year: mesAno[2] ?? '????',
        month: mesAno[1] ?? '0?',
        fields: [],
        bases: [],
      }
      continue
    }

    if (!current) continue
    if (first === 'Verba' || first.startsWith('Verba')) continue

    // Verba: code | label | [base] | valor
    if (/^\/?\d{3}$/.test(first)) {
      const code = first
      const label = cells[1] ?? ''
      if (!label) continue
      const value = stripSign(cells[cells.length - 1] ?? '')
      const reference = cells.length >= 4 ? stripSign(cells[2] ?? '') : ''
      if (value && /^-?[\d.,?]+$/.test(cells[cells.length - 1] ?? '')) {
        current.fields.push(PayrollField.from({ code, label, reference, value }))
      }
      continue
    }

    // Rodapé: "Proventos Bruto: 6.188,63" — pares label:valor, vários por linha.
    for (const match of line.matchAll(BASE_LABEL_RE)) {
      const label = match[1]?.trim()
      const value = match[2] ? stripSign(match[2]) : ''
      if (label && value) current.bases.push(PayrollBase.from({ label, value }))
    }
  }
  flush()

  return pages
}
