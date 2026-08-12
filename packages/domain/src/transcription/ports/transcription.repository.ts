import type { Transcription } from '../entities/transcription.entity.js'
import type { TranscriptionId } from '../value-objects/transcription-id.vo.js'

export interface TranscriptionRepository {
  save(transcription: Transcription): Promise<void>
  findById(id: TranscriptionId): Promise<Transcription | null>
  delete(id: TranscriptionId): Promise<void>
}
