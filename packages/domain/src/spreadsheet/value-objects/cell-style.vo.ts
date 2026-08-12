export const HEADER_STYLE = {
  BOLD: true,
  COLOR: '#FFFFFF',
  BACKGROUND: '#173772',
} as const

export class CellStyle {
  readonly bold: boolean
  readonly color: string
  readonly backgroundColor: string

  private constructor(bold: boolean, color: string, backgroundColor: string) {
    this.bold = bold
    this.color = color
    this.backgroundColor = backgroundColor
  }

  /** Cabeçalho: negrito branco sobre fundo #173772 (formato real de produção). */
  static header(): CellStyle {
    return new CellStyle(HEADER_STYLE.BOLD, HEADER_STYLE.COLOR, HEADER_STYLE.BACKGROUND)
  }
}
