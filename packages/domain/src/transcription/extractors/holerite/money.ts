/**
 * Helpers compartilhados pelos parsers de holerite (valores monetários com
 * sinal, divisão código/descrição).
 */

/**
 * Valor monetário brasileiro, com sinal opcional (descontos negativos).
 *
 * Evita ReDoS: as alternativas são mutuamente exclusivas por contagem de
 * dígitos (1-3 dígitos + separadores de milhar, ou 4+ dígitos sem separador),
 * sem backtracking entre elas.
 */
export const SIGNED_MONEY_RE = /-?(?:[0-9?]{1,3}(?:[.][0-9?]{3})*|[0-9?]{4,}),[0-9?]{1,2}/g

export function moneyTokens(text: string): string[] {
  return [...text.matchAll(SIGNED_MONEY_RE)].map((m) => m[0] ?? '')
}

export function lastMoney(text: string): string | null {
  const moneys = moneyTokens(text)
  return moneys.length > 0 ? (moneys[moneys.length - 1] ?? null) : null
}

/** Remove o sinal: guardamos o valor absoluto (convenção do desafio). */
export function stripSign(value: string): string {
  return value.startsWith('-') ? value.slice(1) : value
}

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
