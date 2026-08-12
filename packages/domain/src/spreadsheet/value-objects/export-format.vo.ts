export const ExportFormat = {
  XLSX: 'xlsx',
  CSV: 'csv',
  JSON: 'json',
} as const

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat]

export function isExportFormat(value: string): value is ExportFormat {
  return value === ExportFormat.XLSX || value === ExportFormat.CSV || value === ExportFormat.JSON
}
