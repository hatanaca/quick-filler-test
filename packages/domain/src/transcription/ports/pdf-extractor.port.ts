export interface PdfExtractorPort {
  /** Texto por página do PDF (strings vazias para páginas escaneadas). */
  extractPages(buffer: Buffer): Promise<string[]>
  /** Renderiza uma página do PDF como imagem (PNG) para fallback de OCR. */
  renderPage(pageIndex: number, buffer: Buffer): Promise<Buffer>
}
