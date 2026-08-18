/**
 * Helpers compartilhados pelos parsers de holerite (valores monetários com
 * sinal).
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

// Re-export de utilitários genéricos de parsing (mantido para compatibilidade
// de imports existentes).
export { cellsOf, splitCodeLabel } from '../parse-utils.js'
