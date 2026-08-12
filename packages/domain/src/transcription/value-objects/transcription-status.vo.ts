export const TranscriptionStatus = {
  PROCESSANDO: 'processando',
  CONCLUIDO: 'concluido',
  ERRO: 'erro',
} as const

export type TranscriptionStatus = (typeof TranscriptionStatus)[keyof typeof TranscriptionStatus]

export function isTranscriptionStatus(value: string): value is TranscriptionStatus {
  return (
    value === TranscriptionStatus.PROCESSANDO ||
    value === TranscriptionStatus.CONCLUIDO ||
    value === TranscriptionStatus.ERRO
  )
}
