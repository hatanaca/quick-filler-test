import {
  DomainError,
  SpreadsheetBuilder,
  type TranscriptionId,
  TranscriptionNotFoundError,
  TranscriptionStatus,
  type ExportFormat,
  type GeneratedSpreadsheet,
  type SpreadsheetGeneratorPort,
  type TranscriptionRepository,
} from '@quickfiller/domain'

export interface ExportSpreadsheetInput {
  id: TranscriptionId
  formato: ExportFormat
}

export class ExportSpreadsheetUseCase {
  constructor(
    private readonly repository: TranscriptionRepository,
    private readonly generator: SpreadsheetGeneratorPort,
  ) {}

  async execute(input: ExportSpreadsheetInput): Promise<GeneratedSpreadsheet> {
    const transcription = await this.repository.findById(input.id)
    if (!transcription) {
      throw new TranscriptionNotFoundError(input.id.value)
    }
    if (transcription.status !== TranscriptionStatus.CONCLUIDO || !transcription.value) {
      throw new DomainError(
        `transcrição ainda não concluída (status: ${transcription.status})`,
      )
    }

    const { headers, rows } = SpreadsheetBuilder.build(
      transcription.value,
      transcription.tipo,
    )
    return this.generator.generate(input.formato, headers, rows)
  }
}
