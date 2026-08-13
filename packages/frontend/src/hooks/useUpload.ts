import { useState } from 'react'

export interface UploadState {
  arquivo: File | null
  tipo: 'cartao-ponto' | 'holerite'
}

export function useUpload() {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [tipo, setTipo] = useState<'cartao-ponto' | 'holerite'>('cartao-ponto')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(onSuccess: (id: string, arquivo: File) => void) {
    if (!arquivo) {
      setErro('selecione um arquivo PDF')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append('arquivo', arquivo)
      form.append('tipo', tipo)
      const response = await fetch('/api/transcricoes', { method: 'POST', body: form })
      const body = (await response.json()) as { id?: string; erro?: string }
      if (!response.ok || !body.id) {
        throw new Error(body.erro ?? `erro ${response.status}`)
      }
      onSuccess(body.id, arquivo)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'falha no envio')
    } finally {
      setEnviando(false)
    }
  }

  return {
    arquivo,
    setArquivo,
    tipo,
    setTipo,
    enviando,
    erro,
    enviar,
  }
}
