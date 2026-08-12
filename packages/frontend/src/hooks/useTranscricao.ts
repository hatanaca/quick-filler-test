import { useCallback, useEffect, useState } from 'react'
import { getTranscription } from '../api/client'
import type { Transcription } from '../types'

const POLL_INTERVAL_MS = 2_000

/**
 * Acompanha uma transcrição até concluir: polling a cada 2s enquanto
 * o status for "processando" — o processamento nunca bloqueia o request.
 */
export function useTranscricao(id: string | null) {
  const [transcricao, setTranscricao] = useState<Transcription | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    try {
      const data = await getTranscription(id)
      setTranscricao(data)
      setErro(null)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'falha ao buscar transcrição')
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    void fetch()
    const timer = setInterval(() => {
      void fetch()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [id, fetch])

  return { transcricao, erro, refetch: fetch }
}
