import { createWorker } from 'tesseract.js'
import type { OcrEnginePort } from '@quickfiller/domain'
import { preprocessImage, type PreprocessMode } from './image-preprocessor.js'

/**
 * Adapter de OCR com Tesseract (local, sem custo, sem API key).
 * O worker é criado uma única vez e reutilizado (warm start ~2s),
 * evitando a inicialização do modelo a cada requisição.
 *
 * Recursos adicionais:
 * - Pré-processamento de imagem (grayscale/contraste/binarização)
 * - Incerteza por caractere: símbolos com confiança abaixo do limiar viram `?`
 */
export class TesseractOcrAdapter implements OcrEnginePort {
  private workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null

  constructor(
    private readonly lang: string = 'por',
    private readonly confidenceThreshold: number = 40,
    private readonly preprocessMode: PreprocessMode = 'auto',
    private readonly psm: number = 6,
    private readonly whitelist: string = '',
  ) {}

  private getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker(this.lang).then(async (worker) => {
        // PSM 6 (bloco uniforme) é melhor que o automático (3) para tabelas
        // de cartão/holerite; whitelist restringe o alfabeto e reduz
        // confusões 8/B, 0/O — vazio = sem restrição.
        const params: Record<string, string> = {
          tessedit_pageseg_mode: String(this.psm),
        }
        if (this.whitelist) params.tessedit_char_whitelist = this.whitelist
        await worker.setParameters(params)
        return worker
      })
    }
    return this.workerPromise
  }

  async recognize(imageBuffer: Buffer): Promise<string> {
    const processed = await preprocessImage(imageBuffer, this.preprocessMode)
    const worker = await this.getWorker()
    const { data } = await worker.recognize(processed)
    return this.buildHonestText(data)
  }

  /**
   * Reconstrói o texto substituindo caracteres com baixa confiança por `?`.
   * A regra do desafio: "quando um caractere não deu para ler com segurança,
   * use ? no lugar dele". Tesseract v7 fornece `data.symbols` com confiança
   * por caractere — mapeamos para o texto honesto.
   */
  private buildHonestText(data: {
    text: string
    symbols?: Array<{
      text: string
      confidence: number
      bbox?: { x0: number; y0: number; x1: number; y1: number }
    }>
  }): string {
    if (!data.symbols || data.symbols.length === 0) {
      return data.text
    }

    let result = ''
    let prevY = 0

    for (const symbol of data.symbols) {
      // Espaços/novas linhas: preservar estrutura do documento.
      if (symbol.text === ' ' || symbol.text === '\n' || symbol.text === '\r') {
        result += symbol.text
        prevY = symbol.bbox?.y0 ?? 0
        continue
      }

      // Se há salto vertical significativo (nova linha), inserir \n.
      const y = symbol.bbox?.y0 ?? 0
      if (Math.abs(y - prevY) > 10) {
        result += '\n'
      }
      prevY = y

      if (symbol.confidence < this.confidenceThreshold) {
        // Símbolo incerto: trocar por `?` (incerteza por caractere).
        result += symbol.text.replace(/[^?\n\r]/g, '?')
      } else {
        result += symbol.text
      }
    }

    return result
  }

  async close(): Promise<void> {
    const worker = this.workerPromise ? await this.workerPromise : null
    this.workerPromise = null
    if (worker) {
      await worker.terminate()
    }
  }
}
