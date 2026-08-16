import { useState } from 'react'
import { createTranscription } from '../api/client'

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
    // guard contra duplo clique: o estado enviando só é aplicado no próximo
    // render, então um segundo clique podia disparar POST duplicado
    if (enviando) return
    setEnviando(true)
    setErro(null)
    try {
      // usa o client central (VITE_API_URL), não '/api/transcricoes' fixo
      const { id } = await createTranscription(arquivo, tipo)
      onSuccess(id, arquivo)
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
