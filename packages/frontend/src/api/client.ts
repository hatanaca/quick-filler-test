import type { DocumentType, Transcription } from '../types'
import { getAccessToken } from './auth'
import { BASE_URL } from './config'

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

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createTranscription(
  arquivo: File,
  tipo: DocumentType,
): Promise<{ id: string }> {
  const form = new FormData()
  form.append('arquivo', arquivo)
  form.append('tipo', tipo)

  const response = await fetch(`${BASE_URL}/api/transcricoes`, {
    method: 'POST',
    body: form,
    headers: authHeaders(),
  })
  return handle<{ id: string }>(response)
}

export async function getTranscription(id: string): Promise<Transcription> {
  const response = await fetch(`${BASE_URL}/api/transcricoes/${id}`, {
    headers: authHeaders(),
  })
  return handle<Transcription>(response)
}

export async function updateTranscription(id: string, value: unknown): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/transcricoes/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ value }),
  })
  await handle<void>(response)
}
