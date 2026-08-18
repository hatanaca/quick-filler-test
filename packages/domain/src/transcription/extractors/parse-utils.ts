/**
 * Utilitários genéricos de parsing de texto, compartilhados pelos
 * extratores de holerite e cartão de ponto.
 */

/**
 * Código de verba: "/314", "/B02", "0105", "40", "7" — opcional. Quando o
 * documento não mostra código, a célula é só a descrição.
 */
const CODE_PREFIX_RE = /^(\/?(?:[0-9]{1,4}|[A-Z][0-9]{2}))\s+(\S.*)$/

export function splitCodeLabel(cell: string): { code: string; label: string } {
  const match = CODE_PREFIX_RE.exec(cell.trim())
  if (match) return { code: match[1] ?? '', label: (match[2] ?? '').trim() }
  return { code: '', label: cell.trim() }
}

/** Divide uma linha em células por tab (colunas) e remove vazias. */
export function cellsOf(line: string): string[] {
  return line
    .split('\t')
    .map((c) => c.trim())
    .filter((c) => c !== '')
}
