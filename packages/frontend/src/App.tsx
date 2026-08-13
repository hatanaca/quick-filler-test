import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateTranscription } from './api/client'
import { Upload } from './components/Upload/Upload'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { PdfViewer } from './components/PdfViewer/PdfViewer'
import { DownloadButton } from './components/DownloadButton'
import { useTranscricao } from './hooks/useTranscricao'

export default function App() {
  const [id, setId] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const queryClient = useQueryClient()
  const { transcricao, erro: fetchErro } = useTranscricao(id)
  const [salvo, setSalvo] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // limpa o debounce pendente no unmount para não disparar PUT em estado morto
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    [],
  )

  const handleUploaded = useCallback((novoId: string, arquivo: File) => {
    setId(novoId)
    setPdfFile(arquivo)
  }, [])

  const handleChange = useCallback(
    (value: unknown) => {
      if (!id || !transcricao) return
      // debounce da persistência: salva 500ms após a última edição
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        updateTranscription(id, value)
          .then(() => {
            setSalvo(true)
            // reflete as correções na tabela (o cache fica stale após o PUT)
            void queryClient.invalidateQueries({ queryKey: ['transcricao', id] })
          })
          .catch(() => setSalvo(false))
      }, 500)
    },
    [id, transcricao, queryClient],
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quick Filler</h1>
        <p className="text-sm text-gray-500">
          Transcrição de cartões de ponto e holerites em PDF para planilha
        </p>
      </header>

      {!id ? (
        <div className="mx-auto max-w-xl">
          <Upload onUploaded={handleUploaded} />
        </div>
      ) : (
        <div>
          {transcricao?.status === 'processando' && (
            <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-4 text-blue-800">
              <p className="font-medium">Processando documento…</p>
              <p className="mt-1 text-sm">
                A leitura leva alguns segundos. Esta página atualiza sozinha.
              </p>
            </div>
          )}

          {transcricao?.status === 'erro' && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">
              <p className="font-medium">Não foi possível transcrever</p>
              <p className="mt-1 text-sm">{transcricao.erro}</p>
              <button
                onClick={() => {
                  setId(null)
                  setPdfFile(null)
                }}
                className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Enviar outro documento
              </button>
            </div>
          )}

          {fetchErro && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">
              {fetchErro}
            </div>
          )}

          {transcricao?.status === 'concluido' && transcricao.value && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">Revisão da transcrição</h2>
                  <DownloadButton id={id} />
                </div>
                {salvo && <p className="mb-2 text-xs text-green-600">Correções salvas ✓</p>}
                <ReviewTable transcricao={transcricao} onChange={handleChange} />
              </div>
              <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-semibold text-gray-800">Documento original</h2>
                <div className="h-[70vh]">
                  <PdfViewer file={pdfFile} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
