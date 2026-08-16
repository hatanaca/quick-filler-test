import { createWorker } from 'tesseract.js'
import type { OcrEnginePort } from '@quickfiller/domain'

/**
 * Adapter de OCR com Tesseract (local, sem custo, sem API key).
 * O worker é criado uma única vez e reutilizado (warm start ~2s),
 * evitando a inicialização do modelo a cada requisição.
 */
export class TesseractOcrAdapter implements OcrEnginePort {
  private workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null

  constructor(private readonly lang: string = 'por') {}

  private getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
    // Memoiza a PROMISE, não só o worker: chamadas concorrentes (páginas em
    // paralelo) compartilham a mesma inicialização em vez de criar N workers
    // e vazar todos menos o último.
    if (!this.workerPromise) {
      this.workerPromise = createWorker(this.lang)
    }
    return this.workerPromise
  }

  async recognize(imageBuffer: Buffer): Promise<string> {
    const worker = await this.getWorker()
    const { data } = await worker.recognize(imageBuffer)
    return data.text
  }

  async close(): Promise<void> {
    const worker = this.workerPromise ? await this.workerPromise : null
    this.workerPromise = null
    if (worker) {
      await worker.terminate()
    }
  }
}
