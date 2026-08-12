import { parseDateRaw, type DateParseResult } from '../../shared/utils/date-utils.js'

/**
 * Regra não negociável do domínio: nunca produza uma data impossível.
 * `38/07` ou mês `13` significam erro de leitura, não uma data.
 */
export const DateValidator = {
  parse(raw: string): DateParseResult {
    return parseDateRaw(raw)
  },

  isImpossible(raw: string): boolean {
    return parseDateRaw(raw).status === 'impossible'
  },

  isReadable(raw: string): boolean {
    return parseDateRaw(raw).status === 'readable'
  },
}
