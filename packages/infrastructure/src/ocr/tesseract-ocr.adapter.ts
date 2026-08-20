import { createWorker } from 'tesseract.js'
import type { OcrEnginePort } from '@quickfiller/domain'
import { preprocessImage, type PreprocessMode } from './image-preprocessor.js'

/**
 * Adapter de OCR com Tesseract (local, sem custo, sem API key).
 * O pool de workers é inicializado preguiçosamente e reutilizado
 * (warm start ~2s), evitando a inicialização do modelo a cada requisição.
 * Round-robin distribui chamadas concorrentes entre os workers.
 *
 * Recursos adicionais:
 * - Pré-processamento de imagem (grayscale/contraste/binarização)
 * - Incerteza por caractere: símbolos com confiança abaixo do limiar viram `?`
 */
export class TesseractOcrAdapter implements OcrEnginePort {
  private workers: Promise<Awaited<ReturnType<typeof createWorker>>>[] = []
  private nextWorker = 0

  constructor(
    private readonly lang: string = 'por',
    private readonly confidenceThreshold: number = 40,
    private readonly preprocessMode: PreprocessMode = 'auto',
    private readonly psm: number = 6,
    private readonly whitelist: string = '',
    private readonly poolSize: number = 2,
  ) {}

  private initPool(): void {
    if (this.workers.length > 0) return
    for (let i = 0; i < this.poolSize; i++) {
      this.workers.push(this.initWorker())
    }
  }

  private initWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
    return createWorker(this.lang).then(async (worker) => {
      const params: Record<string, string> = {
        tessedit_pageseg_mode: String(this.psm),
      }
      if (this.whitelist) params.tessedit_char_whitelist = this.whitelist
      await worker.setParameters(params)
      return worker
    })
  }

  private async getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
    this.initPool()
    const worker = await this.workers[this.nextWorker % this.poolSize]!
    this.nextWorker++
    return worker
  }

  async recognize(imageBuffer: Buffer): Promise<string> {
    const processed = await preprocessImage(imageBuffer, this.preprocessMode)
    const worker = await this.getWorker()
    const { data } = await worker.recognize(processed)
    const text = this.buildHonestText(data)

    // Se o modo 'auto'/'grayscale' não extraiu texto útil, tenta 'color'
    // (carimbos vermelhos em fundo branco, ex: time-card-04).
    if (text.trim().length < 10 && this.preprocessMode !== 'color') {
      const colorProcessed = await preprocessImage(imageBuffer, 'color')
      const { data: colorData } = await worker.recognize(colorProcessed)
      const colorText = this.buildHonestText(colorData)
      if (colorText.trim().length > text.trim().length) return colorText
    }

    return text
  }

  /**
   * Reconstrói o texto substituindo caracteres com baixa confiança por `?`.
   * A regra do desafio: "quando um caractere não deu para ler com segurança,
   * use ? no lugar dele". Tesseract.js fornece symbols no nível de Word
   * (data.blocks[i].paragraphs[j].lines[k].words[l].symbols[m]), não no
   * nível de Page — iteramos a hierarquia completa para acessar confiança
   * por caractere.
   */
  private buildHonestText(data: { text: string }): string {
    const symbols = this.extractAllSymbols(data)
    if (symbols.length === 0) {
      return data.text
    }

    let result = ''
    let prevY: number | null = null

    for (const symbol of symbols) {
      const text = symbol.text ?? ''
      if (!text) continue

      // Espaços/novas linhas: preservar estrutura do documento.
      if (text === ' ' || text === '\n' || text === '\r') {
        result += text
        if (symbol.bbox?.y0 !== null && symbol.bbox?.y0 !== undefined) prevY = symbol.bbox.y0
        continue
      }

      // Se há salto vertical significativo (nova linha), inserir \n.
      const y = symbol.bbox?.y0 ?? null
      if (y !== null && prevY !== null && Math.abs(y - prevY) > 10) {
        result += '\n'
      }
      if (y !== null) prevY = y

      const confidence = symbol.confidence ?? 100
      if (confidence < this.confidenceThreshold) {
        // Símbolo incerto: trocar por `?` (incerteza por caractere).
        result += text.replace(/[^?\n\r]/g, '?')
      } else {
        result += text
      }
    }

    return result
  }

  /**
   * Extrai todos os symbols da hierarquia Tesseract:
   * data.blocks -> block.paragraphs -> paragraph.lines -> line.words -> word.symbols
   */
  private extractAllSymbols(data: { text: string }): Array<{
    text: string
    confidence: number
    bbox?: { x0: number; y0: number; x1: number; y1: number }
  }> {
    const symbols: Array<{
      text: string
      confidence: number
      bbox?: { x0: number; y0: number; x1: number; y1: number }
    }> = []

    const blocks = (data as Record<string, unknown>)['blocks'] as
      | Array<{
          paragraphs?: Array<{
            lines?: Array<{
              words?: Array<{
                symbols?: Array<{
                  text: string
                  confidence: number
                  bbox?: { x0: number; y0: number; x1: number; y1: number }
                }>
              }>
            }>
          }>
        }>
      | undefined

    if (!blocks) return symbols

    for (const block of blocks) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const word of line.words ?? []) {
            for (const symbol of word.symbols ?? []) {
              symbols.push(symbol)
            }
          }
        }
      }
    }

    return symbols
  }

  async close(): Promise<void> {
    const resolved = await Promise.allSettled(this.workers)
    await Promise.all(
      resolved
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createWorker>>> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value.terminate()),
    )
    this.workers = []
    this.nextWorker = 0
  }
}
