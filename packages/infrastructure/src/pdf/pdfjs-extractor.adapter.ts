import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import type { PdfExtractorPort } from '@quickfiller/domain'

interface TextItem {
  str: string
  transform?: number[]
}

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
    const doc = await task.promise
    try {
      const texts: string[] = []
      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber)
        const content = await page.getTextContent()
        texts.push(this.groupByLine(content.items as unknown as TextItem[]))
      }
      return texts
    } finally {
      await task.destroy()
    }
  }

  /** Agrupa itens de texto pela coordenada Y (mesma linha) e ordena por X. */
  private groupByLine(items: TextItem[]): string {
    const lines = new Map<number, TextItem[]>()
    for (const item of items) {
      const y = Math.round(item.transform?.[5] ?? 0)
      const list = lines.get(y) ?? []
      list.push(item)
      lines.set(y, list)
    }

    return [...lines.entries()]
      .sort(([yA], [yB]) => yB - yA)
      .map(([, rowItems]) =>
        rowItems
          .sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0))
          .map((item) => item.str)
          .join(' ')
          .trim(),
      )
      .filter(Boolean)
      .join('\n')
  }

  async renderPage(pageIndex: number, buffer: Buffer): Promise<Buffer> {
    const task = getDocument({ data: new Uint8Array(buffer) })
    const doc = await task.promise
    try {
      const page = await doc.getPage(pageIndex + 1)
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
      await task.destroy()
    }
  }
}
