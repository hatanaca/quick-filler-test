import { randomUUID } from 'node:crypto'
import {
  DomainError,
  Transcription,
  TranscriptionId,
  type FileStoragePort,
  type TranscriptionRepository,
} from '@quickfiller/domain'
import type { EventBus } from '../../shared/event-bus/in-memory-event-bus.js'

export interface CreateTranscriptionInput {
  tipo: string
  arquivo: Buffer
  nomeArquivo: string
}

export class CreateTranscriptionUseCase {
  constructor(
    private readonly repository: TranscriptionRepository,
    private readonly storage: FileStoragePort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: CreateTranscriptionInput): Promise<TranscriptionId> {
    if (input.arquivo.length === 0) {
      throw new DomainError('arquivo não pode ser vazio')
    }

    const id = TranscriptionId.from(randomUUID())
    const transcription = Transcription.create({ id, tipo: input.tipo })

    await this.repository.save(transcription)
    await this.storage.save(id.value, input.arquivo)

    for (const event of transcription.pullEvents()) {
      this.eventBus.publish(event)
    }

    return id
  }
}
