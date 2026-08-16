import {
  type Transcription,
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
    private readonly timeoutMs = 60_000,
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
      // Timeout impede que um job travado (ex.: OCR preso) segure o slot da
      // fila para sempre — a promise perdedora do race não vira unhandled
      // rejection e o complete() tardio é bloqueado pelo status já ERRO.
      await withTimeout(this.process(id, transcription), this.timeoutMs, 'processamento')
    } catch (error) {
      // Timeout (ou qualquer falha) não pode segurar o slot da fila para
      // sempre nem deixar a transcrição presa em PROCESSANDO.
      const message =
        error instanceof Error && error.message.trim() ? error.message : 'erro desconhecido'
      transcription.fail(message)
    }

    await this.repository.save(transcription)
  }

  private async process(id: TranscriptionId, transcription: Transcription): Promise<void> {
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
  }
}

/** Executa uma promise com limite de tempo; rejeita com erro legível no estouro. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
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
