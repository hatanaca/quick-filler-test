import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateTranscription } from '../api/client'
import type { Transcription } from '../types'

interface UseAutoSaveOptions {
  id: string | null
  debounceMs?: number
}

interface UseAutoSaveReturn {
  salvo: boolean
  saveErro: string | null
  handleChange: (value: unknown) => void
  resetSave: () => void
}

/**
 * Hook que gerencia auto-save com debounce serializado.
 * - Debounce: salva Nms após a última edição.
 * - Serialização: PUTs não chegam fora de ordem no servidor.
 * - Document switch: PUT do doc A não marca "salvo" para doc B.
 */
export function useAutoSave({ id, debounceMs = 500 }: UseAutoSaveOptions): UseAutoSaveReturn {
  const queryClient = useQueryClient()
  const [salvo, setSalvo] = useState(false)
  const [saveErro, setSaveErro] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const currentIdRef = useRef<string | null>(null)

  useEffect(() => {
    currentIdRef.current = id
  }, [id])

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    [],
  )

  const resetSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    setSalvo(false)
    setSaveErro(null)
  }, [])

  const handleChange = useCallback(
    (value: unknown) => {
      if (!id) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveChain.current = saveChain.current
          .then(() => updateTranscription(id, value))
          .then(() => {
            if (currentIdRef.current !== id) return
            setSalvo(true)
            setSaveErro(null)
            queryClient.setQueryData<Transcription>(['transcricao', id], (prev) =>
              prev ? { ...prev, value: value as Transcription['value'] } : prev,
            )
          })
          .catch((error: unknown) => {
            if (currentIdRef.current !== id) return
            setSalvo(false)
            setSaveErro(
              error instanceof Error && error.message ? error.message : 'falha ao salvar correção',
            )
          })
      }, debounceMs)
    },
    [id, queryClient, debounceMs],
  )

  return { salvo, saveErro, handleChange, resetSave }
}
