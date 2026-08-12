import type { ExportFormat } from '../value-objects/export-format.vo.js'
import type { RowHighlight } from '../value-objects/row-highlight.vo.js'

export interface SpreadsheetRowData {
  cells: (string | null)[]
  highlight: RowHighlight | null
}

export interface GeneratedSpreadsheet {
  buffer: Buffer
  mimeType: string
  extension: string
}

export interface SpreadsheetGeneratorPort {
  generate(
    format: ExportFormat,
    headers: string[],
    rows: SpreadsheetRowData[],
  ): Promise<GeneratedSpreadsheet>
}
