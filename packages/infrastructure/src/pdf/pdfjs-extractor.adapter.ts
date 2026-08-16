import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import type { PdfExtractorPort } from '@quickfiller/domain'

interface TextItem {
  str: string
  transform?: number[]
  width?: number
}

/**
 * Gap horizontal (fim do item anterior → início do atual) acima do qual
 * consideramos uma quebra de coluna. Em pontos de PDF: letras/fontes ficam
 * ~3-5pt de distância dentro de uma coluna; colunas de tabelas reais ficam
 * 11pt+ separadas (medido nos PDFs de exemplo).
 */
const COLUMN_GAP_THRESHOLD = 8

/**
 * Adapter de PDF usando pdfjs-dist.
 * - extractPages: texto embutido por página, com quebras de linha
 *   reconstruídas a partir das posições Y dos itens de texto
 *   (PDFs reais não têm \n — a linha é inferida pela geometria)
 * - renderPage: renderiza página como PNG para fallback de OCR
 */
export class PdfJsExtractorAdapter implements PdfExtractorPort {
  async extractPages(buffer: Buffer): Promise<string[]> {
    const task = getDocument({ data: new Uint8Array(buffer) })
    try {
      const doc = await task.promise
      const texts = await Promise.all(
        Array.from({ length: doc.numPages }, async (_, pageNumber) => {
          const page = await doc.getPage(pageNumber + 1)
          try {
            const content = await page.getTextContent()
            return this.groupByLine(content.items as unknown as TextItem[])
          } finally {
            // Libera os dados da página do pdf.js; sem cleanup o pico de
            // memória cresce com o número de páginas em PDFs grandes.
            page.cleanup()
          }
        }),
      )
      return texts
    } finally {
      // destroy em finally cobre também PDF corrompido (task.promise rejeita)
      await task.destroy()
    }
  }

  /**
   * Agrupa itens de texto pela coordenada Y (mesma linha) e ordena por X.
   * Insere `\t` quando o gap horizontal entre itens vizinhos ultrapassa o
   * limiar — preserva o alinhamento de colunas de tabelas (essencial para
   * holerites de 3 colunas e cartões com Jornada/Ocorrência/Qtde).
   */
  private groupByLine(items: TextItem[]): string {
    const lines = new Map<number, TextItem[]>()
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue
      const y = Math.round(item.transform?.[5] ?? 0)
      const list = lines.get(y) ?? []
      list.push(item)
      lines.set(y, list)
    }

    return [...lines.entries()]
      .sort(([yA], [yB]) => yB - yA)
      .map(([, rowItems]) => {
        rowItems.sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0))
        let line = ''
        let prevEnd: number | null = null
        for (const item of rowItems) {
          const str = item.str.trim()
          if (!str) continue
          const x = item.transform?.[4] ?? 0
          if (prevEnd !== null) {
            line += x - prevEnd > COLUMN_GAP_THRESHOLD ? '\t' : ' '
          }
          line += str
          prevEnd = x + (item.width ?? 0)
        }
        return line
      })
      .filter(Boolean)
      .join('\n')
  }

  async renderPage(pageIndex: number, buffer: Buffer): Promise<Buffer> {
    const task = getDocument({ data: new Uint8Array(buffer) })
    try {
      const doc = await task.promise
      const page = await doc.getPage(pageIndex + 1)
      try {
        const viewport = page.getViewport({ scale: 2 })

        const canvas = createCanvas(viewport.width, viewport.height)
        const ctx = canvas.getContext('2d')

        await page.render({
          canvasContext: ctx,
          canvas: canvas as never,
          viewport,
        }).promise

        return canvas.toBuffer('image/png')
      } finally {
        page.cleanup()
      }
    } finally {
      await task.destroy()
    }
  }
}
