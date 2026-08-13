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
    private readonly concurrencyLimit = 2,
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

      // Páginas escaneadas devolvem texto vazio — fallback para OCR.
      // Render + OCR em paralelo com limite de concorrência (tesseract é
      // intensivo; processar tudo de uma vez estouraria a memória).
      const completeTexts = await runWithConcurrency(
        pagesText,
        this.concurrencyLimit,
        async (text, index) => {
          if (text.trim()) return text
          const image = await this.pdfExtractor.renderPage(index, buffer)
          return this.ocrEngine.recognize(image)
        },
      )

      const result = extractorFor(transcription.tipo).extract(completeTexts)
      transcription.complete(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      transcription.fail(message)
    }

    await this.repository.save(transcription)
  }
}

/** Executa tasks em lote com no máximo `limit` em andamento. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<string>,
): Promise<string[]> {
  const results: string[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await task(items[index] as T, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}
