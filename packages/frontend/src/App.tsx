import { useCallback, useState } from 'react'
import { Upload } from './components/Upload/Upload'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { PdfViewer } from './components/PdfViewer/PdfViewer'
import { DownloadButton } from './components/DownloadButton'
import { useTranscricao } from './hooks/useTranscricao'
import { useAutoSave } from './hooks/useAutoSave'
import { useAuth } from './contexts/AuthContext'

export default function App() {
  const { user, logout } = useAuth()
  const [id, setId] = useState<string | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const { transcricao, erro: fetchErro } = useTranscricao(id)
  const { salvo, saveErro, handleChange, resetSave } = useAutoSave({ id })

  const handleUploaded = useCallback(
    (novoId: string, arquivo: File) => {
      resetSave()
      setId(novoId)
      setPdfFile(arquivo)
    },
    [resetSave],
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
                className="mb-4 rounded border-2 border-red-400 bg-red-50 p-6 shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-2xl text-red-600" aria-hidden="true">
                    &#x26A0;
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-red-800">
                      Não foi possível transcrever o documento
                    </p>
                    <p className="mt-2 text-sm text-red-700">{transcricao.erro}</p>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => {
                          setId(null)
                          setPdfFile(null)
                        }}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Enviar outro documento
                      </button>
                    </div>
                  </div>
                </div>
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
                  {(!transcricao.value?.pages || transcricao.value.pages.length === 0) && (
                    <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                      <p className="font-medium">Nenhum dado foi extraído deste documento.</p>
                      <p className="mt-1">
                        O PDF pode conter apenas imagens escaneadas sem texto embutido, ou o
                        conteúdo não foi reconhecido. Tente enviar outro arquivo ou verifique se o
                        PDF contém texto selecionável.
                      </p>
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
