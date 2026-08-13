import { DomainError } from '../../shared/errors/domain.error.js'

const TRANSCRIPTION_ID_BRAND = Symbol('TranscriptionId')

// Formato canônico de UUID (como gerado por randomUUID). Garantir o formato
// no value object impede path traversal e injeção via id em caminhos de
// arquivo (DiskFileStorage) e em headers de resposta (Content-Disposition).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface TranscriptionId {
  readonly value: string
  readonly [TRANSCRIPTION_ID_BRAND]: true
}

export const TranscriptionId = {
  from(value: string): TranscriptionId {
    if (!UUID_RE.test(value)) {
      throw new DomainError('id deve ser um UUID válido')
    }
    return { value, [TRANSCRIPTION_ID_BRAND]: true } as TranscriptionId
  },
}
