import {
  type TranscriptionId,
  TranscriptionNotFoundError,
  type TranscriptionRepository,
  type TranscriptionResult,
} from '@quickfiller/domain'

export interface UpdateTranscriptionInput {
  id: TranscriptionId
  value: TranscriptionResult
}

export class UpdateTranscriptionUseCase {
  constructor(private readonly repository: TranscriptionRepository) {}

  async execute(input: UpdateTranscriptionInput): Promise<void> {
    const transcription = await this.repository.findById(input.id)
    if (!transcription) {
      throw new TranscriptionNotFoundError(input.id.value)
    }
    transcription.updateValue(input.value)
    await this.repository.save(transcription)
  }
}
