import { useRef } from 'react'
import { useUpload } from '../../hooks/useUpload'

interface UploadProps {
  onUploaded: (id: string) => void
}

export function Upload({ onUploaded }: UploadProps) {
  const { arquivo, setArquivo, tipo, setTipo, enviando, erro, enviar } = useUpload()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">Enviar documento</h2>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de documento</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value="cartao-ponto"
              checked={tipo === 'cartao-ponto'}
              onChange={() => setTipo('cartao-ponto')}
            />
            Cartão de ponto
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo"
              value="holerite"
              checked={tipo === 'holerite'}
              onChange={() => setTipo('holerite')}
            />
            Holerite
          </label>
        </div>
      </div>

      <div className="mb-4">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700 hover:file:bg-blue-100"
        />
        {arquivo && (
          <p className="mt-1 text-xs text-gray-500">
            {arquivo.name} ({Math.round(arquivo.size / 1024)} KB)
          </p>
        )}
      </div>

      <button
        onClick={() => void enviar(onUploaded)}
        disabled={enviando || !arquivo}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        {enviando ? 'Enviando…' : 'Enviar e processar'}
      </button>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
    </div>
  )
}
