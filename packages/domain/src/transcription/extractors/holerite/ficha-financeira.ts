import { PageHolerite } from '../../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../../value-objects/payroll-base.vo.js'
import { PayrollField } from '../../value-objects/payroll-field.vo.js'
import { parseMonthYearAbbr } from '../../../shared/utils/date-utils.js'
import { cellsOf, splitCodeLabel, stripSign } from './money.js'

/** Rótulos da coluna RESULTADOS → nome canônico de base. */
const RESULT_BASES: Record<string, string> = {
  BASEDECALCULODOINSS: 'Base INSS',
  BASEDECALCULODOIRF: 'Base IR',
  BASEDECALCULODOFGTS: 'Base FGTS',
  VALORDOFGTS: 'FGTS',
  SALARIOLIQUIDONOMES: 'Valor Líquido',
  VALORDOIRFARECOLHER: 'IRRF a Recolher',
}

/** Linhas de totais (coluna Total) — ignoradas conforme o bônus "ficha financeira". */
const TOTAL_ROWS = new Set(['TOT.RENDIMENTOS', 'TOTALDESCONTOS'])

function isNumberCell(cell: string): boolean {
  return /^-?[\d.,]+$/.test(cell) && cell !== '-' && cell !== ''
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * "FICHA FINANCEIRA": vários meses por página em 3 colunas
 * (RENDIMENTOS | DESCONTOS | RESULTADOS). Cada bloco "Mês: abr-17" vira uma
 * entrada compartilhando o mesmo `page`. RENDIMENTOS + DESCONTOS viram
 * `fields` (código 1-3 dígitos opcional); RESULTADOS viram `bases`.
 */
export function parseFichaFinanceira(text: string, pageIndex: number): PageHolerite[] {
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
    const trimmed = line.trim()
    if (!trimmed) continue

    // "Mês: abr-17" inicia uma nova competência.
    const mesMatch = /^M[eê]s\s*:\s*(.+)$/.exec(trimmed)
    if (mesMatch) {
      flush()
      const my = parseMonthYearAbbr(mesMatch[1] ?? '')
      if (my) {
        current = {
          year: String(my.year),
          month: twoDigits(my.month),
          fields: [],
          bases: [],
        }
      }
      continue
    }

    if (!current) continue

    const cells = cellsOf(line)
    if (cells.length < 2) continue // cabeçalho de seção ("Folha Normal", ...)

    // Coluna RESULTADOS: rótulo conhecido marca o início das bases.
    let resultIndex = -1
    for (let i = 0; i < cells.length; i++) {
      if (RESULT_BASES[cells[i] ?? '']) {
        resultIndex = i
        break
      }
    }

    if (resultIndex >= 0) {
      for (let i = resultIndex; i + 1 < cells.length; i += 2) {
        const label = RESULT_BASES[cells[i] ?? '']
        const value = cells[i + 1] ?? ''
        if (label && value) {
          current.bases.push(PayrollBase.from({ label, value: stripSign(value) }))
        }
      }
    }

    const fieldCells = resultIndex >= 0 ? cells.slice(0, resultIndex) : cells
    parseFichaFields(fieldCells, current.fields)
  }
  flush()

  return pages
}

function parseFichaFields(cells: string[], fields: PayrollField[]): void {
  let i = 0
  while (i < cells.length) {
    const { code, label } = splitCodeLabel(cells[i] ?? '')
    i++
    if (!label || TOTAL_ROWS.has(label)) continue

    let reference = ''
    let value = ''
    if (i < cells.length && isNumberCell(cells[i] ?? '')) {
      if (i + 1 < cells.length && isNumberCell(cells[i + 1] ?? '')) {
        reference = cells[i] ?? ''
        value = cells[i + 1] ?? ''
        i += 2
      } else {
        value = cells[i] ?? ''
        i += 1
      }
    }

    if (value) {
      fields.push(
        PayrollField.from({
          code,
          label,
          reference: stripSign(reference),
          value: stripSign(value),
        }),
      )
    }
  }
}
