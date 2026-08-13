import { useQuery } from '@tanstack/react-query'
import { getTranscription } from '../api/client'

const POLL_INTERVAL_MS = 2_000

/**
 * Acompanha uma transcrição até concluir: o react-query faz polling a cada
 * 2s enquanto o status for "processando" (refetchInterval é desligado
 * automaticamente quando o status é terminal). O cache evita requisições
 * duplicadas e o estado é limpo ao desmontar.
 */
export function useTranscricao(id: string | null) {
  const query = useQuery({
    queryKey: ['transcricao', id],
    queryFn: () => getTranscription(id as string),
    enabled: id !== null,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'processando' ? POLL_INTERVAL_MS : false,
  })

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
