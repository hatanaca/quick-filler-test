import type { DocumentType, ExportFormat, Transcription } from '../types'
import { authenticatedFetch, getAccessToken } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `erro ${response.status}`
    try {
      const body = (await response.json()) as { erro?: string }
      if (body.erro) message = body.erro
    } catch {
      // corpo não-JSON — mantém mensagem genérica
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export async function createTranscription(
  arquivo: File,
  tipo: DocumentType,
): Promise<{ id: string }> {
  const form = new FormData()
  form.append('arquivo', arquivo)
  form.append('tipo', tipo)

  const token = getAccessToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await authenticatedFetch(`${BASE_URL}/api/transcricoes`, {
    method: 'POST',
    headers,
    body: form,
  })
  return handle<{ id: string }>(response)
}

export async function getTranscription(id: string): Promise<Transcription> {
  const response = await authenticatedFetch(`${BASE_URL}/api/transcricoes/${id}`)
  return handle<Transcription>(response)
}

export async function updateTranscription(id: string, value: unknown): Promise<void> {
  const response = await authenticatedFetch(`${BASE_URL}/api/transcricoes/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  await handle<void>(response)
}

export function downloadSpreadsheetUrl(id: string, formato: ExportFormat): string {
  const token = getAccessToken()
  return `${BASE_URL}/api/transcricoes/${id}/planilha?formato=${formato}${token ? `&token=${token}` : ''}`
}
