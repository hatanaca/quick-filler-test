import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTranscription } from '../api/client'

const POLL_INTERVAL_MS = 2_000

/**
 * Acompanha uma transcrição até concluir: o react-query faz polling a cada
 * 2s enquanto o status for "processando" (refetchInterval é desligado
 * automaticamente quando o status é terminal). O cache evita requisições
 * duplicadas e o estado é limpo ao desmontar.
 */
export function useTranscricao(id: string | null) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['transcricao', id],
    queryFn: () => getTranscription(id as string),
    enabled: id !== null,
    // retry: false + falha transitória desligava o polling para sempre
    // (data ficava undefined e o intervalo parava de consultar)
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.status === 'processando' ? POLL_INTERVAL_MS : false,
  })

  // Status terminal → cancela poll em voo para não reverter "concluido"
  // com uma resposta atrasada de "processando".
  const status = query.data?.status
  useEffect(() => {
    if (status === 'concluido' || status === 'erro') {
      void queryClient.cancelQueries({ queryKey: ['transcricao', id] })
    }
  }, [status, id, queryClient])

  return {
    transcricao: query.data ?? null,
    erro: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : 'falha ao buscar transcrição'
      : null,
    refetch: query.refetch,
  }
}
