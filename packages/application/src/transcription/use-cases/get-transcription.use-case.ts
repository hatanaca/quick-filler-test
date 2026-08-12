import {
  TranscriptionNotFoundError,
  type TranscriptionId,
  type TranscriptionRepository,
} from '@quickfiller/domain'
import type { TranscriptionResponse } from '../mappers/transcription.mapper.js'
import { toResponse } from '../mappers/transcription.mapper.js'

export class GetTranscriptionUseCase {
  constructor(private readonly repository: TranscriptionRepository) {}

  async execute(id: TranscriptionId): Promise<TranscriptionResponse> {
    const transcription = await this.repository.findById(id)
    if (!transcription) {
      throw new TranscriptionNotFoundError(id.value)
    }
    return toResponse(transcription)
  }
}
