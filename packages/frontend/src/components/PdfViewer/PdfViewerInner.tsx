import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export function PdfViewerInner({ file }: { file: File }) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [url, setUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    setPageNumber(1)
    setNumPages(0)
    setLoadError(false)
    return () => URL.revokeObjectURL(next)
  }, [file])

  function handleRetry() {
    setLoadError(false)
    setRetryKey((k) => k + 1)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
        <button
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40"
          aria-label="Página anterior"
        >
          ←
        </button>
        <span>
          Página {pageNumber} de {numPages || '…'}
        </span>
        <button
          disabled={pageNumber >= numPages}
          onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40"
          aria-label="Próxima página"
        >
          →
        </button>
      </div>
      <div className="flex-1 overflow-auto border border-gray-200 bg-gray-100 p-2">
        {loadError ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-3 text-center"
          >
            <p className="text-sm text-red-600">Não foi possível carregar o PDF.</p>
            <button
              onClick={handleRetry}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <Document
            key={retryKey}
            file={url ?? undefined}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n)
              setLoadError(false)
            }}
            onLoadError={() => setLoadError(true)}
            className="mx-auto"
          >
            <Page pageNumber={pageNumber} renderTextLayer renderAnnotationLayer width={480} />
          </Document>
        )}
      </div>
    </div>
  )
}
