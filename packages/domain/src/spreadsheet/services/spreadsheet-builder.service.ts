import { DocumentType } from '../../transcription/value-objects/document-type.vo.js'
import type { CartaoPontoResult, HoleriteResult, TranscriptionResult } from '../../transcription/value-objects/transcription-result.vo.js'
import { WarningCalculator } from '../../transcription/services/warning-calculator.service.js'
import { HighlightDetector } from './highlight-detector.service.js'
import type { SpreadsheetRowData } from '../ports/spreadsheet-generator.port.js'

export interface BuiltSpreadsheet {
  headers: string[]
  rows: SpreadsheetRowData[]
}

function buildCartaoPonto(result: CartaoPontoResult): BuiltSpreadsheet {
  const days = result.pages.flatMap((page) => page.days)
  const maxPunches = Math.max(0, ...days.map((day) => day.punches.length))
  const pairs = Math.ceil(maxPunches / 2)

  const headers = ['Data']
  for (let pair = 1; pair <= pairs; pair++) {
    headers.push(`Entrada ${pair}`, `Saída ${pair}`)
  }

  const warnings = WarningCalculator.cartaoPonto(days)
  const rows: SpreadsheetRowData[] = days.map((day, index) => {
    const cells: (string | null)[] = [day.date_raw, ...day.punches.map((p) => p.time_hhmm)]
    while (cells.length < headers.length) cells.push(null)

    const isNonSequential = warnings
      .find((w) => w.index === index)
      ?.types.includes('non-sequential-date') ?? false

    return { cells, highlight: HighlightDetector.cartaoPontoDay(day, isNonSequential) }
  })

  return { headers, rows }
}

function buildHolerite(result: HoleriteResult): BuiltSpreadsheet {
  // União de todos os labels de fields, na ordem de primeira aparição no documento
  const labels: string[] = []
  for (const page of result.pages) {
    for (const field of page.fields) {
      if (!labels.includes(field.label)) labels.push(field.label)
    }
  }

  const headers = ['Pág.', 'Mês', 'Ano', ...labels]

  const warnings = WarningCalculator.holerite(result.pages)
  const rows: SpreadsheetRowData[] = result.pages.map((page) => {
    const cells: (string | null)[] = [
      String(page.page),
      page.month,
      page.year,
      ...labels.map((label) => page.fields.find((f) => f.label === label)?.value ?? null),
    ]

    const isNonSequential = warnings
      .find((w) => w.page === page.page)
      ?.types.includes('non-sequential-month') ?? false

    return { cells, highlight: HighlightDetector.holeritePage(page, isNonSequential) }
  })

  return { headers, rows }
}

/**
 * Transpõe o resultado da transcrição para a forma de planilha.
 * Cartão: lista vertical de dias → colunas Data/Entrada/Saída.
 * Holerite: lista vertical de verbas por página → matriz larga (uma coluna por verba).
 */
export const SpreadsheetBuilder = {
  build(result: TranscriptionResult, tipo: DocumentType): BuiltSpreadsheet {
    if (tipo === DocumentType.CARTAO_PONTO) return buildCartaoPonto(result as CartaoPontoResult)
    return buildHolerite(result as HoleriteResult)
  },
}
