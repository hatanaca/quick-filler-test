import {
  type TranscriptionId,
  TranscriptionNotFoundError,
  TranscriptionStatus,
  extractorFor,
  type FileStoragePort,
  type OcrEnginePort,
  type PdfExtractorPort,
  type TranscriptionRepository,
} from '@quickfiller/domain'

export class ProcessTranscriptionUseCase {
  constructor(
    private readonly repository: TranscriptionRepository,
    private readonly storage: FileStoragePort,
    private readonly pdfExtractor: PdfExtractorPort,
    private readonly ocrEngine: OcrEnginePort,
  ) {}

  async execute(id: TranscriptionId): Promise<void> {
    const transcription = await this.repository.findById(id)
    if (!transcription) {
      throw new TranscriptionNotFoundError(id.value)
    }
    // Idempotente: se já foi concluída (ex.: correção manual durante o
    // processamento), não reprocessa.
    if (transcription.status !== TranscriptionStatus.PROCESSANDO) {
      return
    }

    try {
      const buffer = await this.storage.read(id.value)
      const pagesText = await this.pdfExtractor.extractPages(buffer)

      // Páginas escaneadas devolvem texto vazio — fallback para OCR
      const completeTexts: string[] = []
      for (let index = 0; index < pagesText.length; index++) {
        const text = pagesText[index] ?? ''
        if (text.trim()) {
          completeTexts.push(text)
        } else {
          const image = await this.pdfExtractor.renderPage(index, buffer)
          completeTexts.push(await this.ocrEngine.recognize(image))
        }
      }

      const result = extractorFor(transcription.tipo).extract(completeTexts)
      transcription.complete(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      transcription.fail(message)
    }

    await this.repository.save(transcription)
  }
}
