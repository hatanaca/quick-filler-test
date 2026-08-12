import { lazy, Suspense } from 'react'

const PdfViewerInner = lazy(() =>
  import('./PdfViewerInner').then((m) => ({ default: m.PdfViewerInner })),
)

interface PdfViewerProps {
  file: File | null
}

export function PdfViewer({ file }: PdfViewerProps) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
        Envie um PDF para visualizar ao lado da tabela
      </div>
    )
  }
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          Carregando visualizador…
        </div>
      }
    >
      <PdfViewerInner file={file} />
    </Suspense>
  )
}
