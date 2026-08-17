import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateTranscription } from './api/client'
import type { Transcription } from './types'
import { Upload } from './components/Upload/Upload'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { PdfViewer } from './components/PdfViewer/PdfViewer'
import { DownloadButton } from './components/DownloadButton'
import { useTranscricao } from './hooks/useTranscricao'
import { useAuth } from './contexts/AuthContext'

export default function App() {
  const { user, logout } = useAuth()
  const [id, setId] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const queryClient = useQueryClient()
  const { transcricao, erro: fetchErro } = useTranscricao(id)
  const [salvo, setSalvo] = useState(false)
  const [saveErro, setSaveErro] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Serializa PUTs: dois saves debounced sobrepostos não podem chegar fora de
  // ordem no servidor (payload antigo gravado por último revertia a edição).
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  // Id do documento em exibição: um PUT do doc A que resolve após o upload do
  // doc B não pode marcar "salvo ✓" para o B (glitch de estado global).
  const currentIdRef = useRef<string | null>(null)

  // limpa o debounce pendente no unmount para não disparar PUT em estado morto
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    [],
  )

  const handleUploaded = useCallback((novoId: string, arquivo: File) => {
    // troca de documento: aborta PUT pendente do documento anterior
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    currentIdRef.current = novoId
    setId(novoId)
    setPdfFile(arquivo)
    setSalvo(false)
    setSaveErro(null)
  }, [])

  const handleChange = useCallback(
    (value: unknown) => {
      if (!id || !transcricao) return
      // debounce da persistência: salva 500ms após a última edição
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveChain.current = saveChain.current
          .then(() => updateTranscription(id, value))
          .then(() => {
            // Se o usuário já trocou de documento, o PUT é do doc antigo —
            // não mexe no indicador global de salvo do documento atual.
            if (currentIdRef.current !== id) return
            setSalvo(true)
            setSaveErro(null)
            // Atualiza o cache com o valor que enviamos — sem refetch, que
            // sobrescreveria caracteres digitados depois do snapshot do PUT.
            queryClient.setQueryData<Transcription>(['transcricao', id], (prev) =>
              prev ? { ...prev, value: value as Transcription['value'] } : prev,
            )
          })
          .catch((error: unknown) => {
            if (currentIdRef.current !== id) return
            setSalvo(false)
            // erro de validação do servidor (400) não pode ser silencioso —
            // o usuário precisa saber que a correção não foi persistida
            setSaveErro(
              error instanceof Error && error.message ? error.message : 'falha ao salvar correção',
            )
          })
      }, 500)
    },
    [id, transcricao, queryClient],
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quick Filler</h1>
          <p className="text-sm text-gray-500">
            Transcrição de cartões de ponto e holerites em PDF para planilha
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{user?.email}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={() => {
              setId(null)
              setPdfFile(null)
              logout()
            }}
            className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300"
          >
            Sair
          </button>
        </div>
      </header>

      <main>
        {!id ? (
          <div className="mx-auto max-w-xl">
            <Upload onUploaded={handleUploaded} />
          </div>
        ) : (
          <div>
            {transcricao?.status === 'processando' && (
              <div
                role="status"
                className="mb-4 rounded border border-blue-200 bg-blue-50 p-4 text-blue-800"
              >
                <p className="font-medium">Processando documento…</p>
                <p className="mt-1 text-sm">
                  A leitura leva alguns segundos. Esta página atualiza sozinha.
                </p>
              </div>
            )}

            {transcricao?.status === 'erro' && (
              <div
                role="alert"
                className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800"
              >
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
              <div
                role="alert"
                className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800"
              >
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
                  {salvo && (
                    <p role="status" className="mb-2 text-xs text-green-600">
                      Correções salvas ✓
                    </p>
                  )}
                  {saveErro && (
                    <div
                      role="alert"
                      className="mb-2 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                    >
                      <span aria-hidden="true" className="mt-0.5 font-bold">
                        !
                      </span>
                      <span>Não foi possível salvar: {saveErro}</span>
                    </div>
                  )}
                  <ReviewTable key={id} transcricao={transcricao} onChange={handleChange} />
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
      </main>
    </div>
  )
}
