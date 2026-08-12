import { useMemo, useState } from 'react'
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
  const url = useMemo(() => URL.createObjectURL(file), [file])

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
        <button
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40"
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
        >
          →
        </button>
      </div>
      <div className="flex-1 overflow-auto border border-gray-200 bg-gray-100 p-2">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          className="mx-auto"
        >
          <Page pageNumber={pageNumber} renderTextLayer renderAnnotationLayer width={480} />
        </Document>
      </div>
    </div>
  )
}
