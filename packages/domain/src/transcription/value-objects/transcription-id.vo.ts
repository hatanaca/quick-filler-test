import { DomainError } from '../../shared/errors/domain.error.js'

const TRANSCRIPTION_ID_BRAND = Symbol('TranscriptionId')

export interface TranscriptionId {
  readonly value: string
  readonly [TRANSCRIPTION_ID_BRAND]: true
}

export const TranscriptionId = {
  from(value: string): TranscriptionId {
    if (!value.trim()) {
      throw new DomainError('id não pode ser vazia')
    }
    return { value, [TRANSCRIPTION_ID_BRAND]: true } as TranscriptionId
  },
}
