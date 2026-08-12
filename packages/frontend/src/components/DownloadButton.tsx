import type { ExportFormat } from '../types'
import { downloadSpreadsheetUrl } from '../api/client'

interface DownloadButtonProps {
  id: string
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
]

export function DownloadButton({ id }: DownloadButtonProps) {
  return (
    <div className="flex items-center gap-2">
      {FORMATS.map(({ value, label }) => (
        <a
          key={value}
          href={downloadSpreadsheetUrl(id, value)}
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
        >
          Baixar {label}
        </a>
      ))}
    </div>
  )
}
