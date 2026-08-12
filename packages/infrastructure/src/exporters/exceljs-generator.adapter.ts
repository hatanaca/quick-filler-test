import ExcelJS from 'exceljs'
import {
  CellStyle,
  type ExportFormat,
  type GeneratedSpreadsheet,
  type SpreadsheetGeneratorPort,
  type SpreadsheetRowData,
} from '@quickfiller/domain'

const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
} as const

/**
 * Gera a planilha no formato real de produção:
 * cabeçalho negrito branco sobre #173772; linhas com aviso em
 * #FFF3CD (amarelo) ou #F8D7DA (vermelho) com borda esquerda #DC3545.
 */
export class ExcelJsGeneratorAdapter implements SpreadsheetGeneratorPort {
  async generate(
    format: ExportFormat,
    headers: string[],
    rows: SpreadsheetRowData[],
  ): Promise<GeneratedSpreadsheet> {
    const buffer =
      format === 'xlsx'
        ? await this.buildXlsx(headers, rows)
        : format === 'csv'
          ? this.buildCsv(headers, rows)
          : this.buildJson(headers, rows)

    return { buffer, mimeType: MIME[format], extension: format }
  }

  private async buildXlsx(headers: string[], rows: SpreadsheetRowData[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Transcrição')

    const headerStyle = CellStyle.header()
    const headerRow = sheet.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.font = { bold: headerStyle.bold, color: { argb: headerStyle.color.replace('#', 'FF') } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerStyle.backgroundColor.replace('#', 'FF') },
      }
    })

    for (const rowData of rows) {
      const row = sheet.addRow(rowData.cells.map((cell) => cell ?? ''))
      const highlight = rowData.highlight
      if (!highlight) continue

      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: highlight.backgroundColor.replace('#', 'FF') },
        }
        if (highlight.leftBorderColor) {
          cell.border = {
            left: { style: 'thick', color: { argb: highlight.leftBorderColor.replace('#', 'FF') } },
          }
        }
      })
    }

    sheet.columns.forEach((column) => {
      column.width = 18
    })

    return Buffer.from(await workbook.xlsx.writeBuffer())
  }

  private buildCsv(headers: string[], rows: SpreadsheetRowData[]): Buffer {
    const escape = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replaceAll('"', '""')}"`
      }
      return value
    }
    const lines = [
      headers.map(escape).join(','),
      ...rows.map((row) => row.cells.map((cell) => escape(cell ?? '')).join(',')),
    ]
    // BOM UTF-8 para o Excel abrir acentos corretamente
    return Buffer.from(`\uFEFF${lines.join('\n')}\n`, 'utf8')
  }

  private buildJson(headers: string[], rows: SpreadsheetRowData[]): Buffer {
    const objects = rows.map((row) => {
      const obj: Record<string, string | null> = {}
      headers.forEach((header, index) => {
        obj[header] = row.cells[index] ?? null
      })
      return obj
    })
    return Buffer.from(JSON.stringify(objects, null, 2), 'utf8')
  }
}
