import { createWorker } from 'tesseract.js'
import type { OcrEnginePort } from '@quickfiller/domain'

/**
 * Adapter de OCR com Tesseract (local, sem custo, sem API key).
 * O worker é criado uma única vez e reutilizado (warm start ~2s),
 * evitando a inicialização do modelo a cada requisição.
 */
export class TesseractOcrAdapter implements OcrEnginePort {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null

  constructor(private readonly lang: string = 'por') {}

  private async getWorker() {
    if (!this.worker) {
      this.worker = await createWorker(this.lang)
    }
    return this.worker
  }

  async recognize(imageBuffer: Buffer): Promise<string> {
    const worker = await this.getWorker()
    const { data } = await worker.recognize(imageBuffer)
    return data.text
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}
