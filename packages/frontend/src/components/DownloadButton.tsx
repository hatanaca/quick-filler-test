import type { ExportFormat } from '../types'
import { authenticatedFetch } from '../api/auth'

interface DownloadButtonProps {
  id: string
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
]

function ext(formato: ExportFormat): string {
  if (formato === 'xlsx') return '.xlsx'
  if (formato === 'csv') return '.csv'
  return '.json'
}

export function DownloadButton({ id }: DownloadButtonProps) {
  async function handleDownload(formato: ExportFormat) {
    const response = await authenticatedFetch(`/api/transcricoes/${id}/planilha?formato=${formato}`)
    if (!response.ok) return
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcricao${ext(formato)}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-2">
      {FORMATS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => void handleDownload(value)}
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
        >
          Baixar {label}
        </button>
      ))}
    </div>
  )
}
