import { RowHighlight } from '../value-objects/row-highlight.vo.js'
import type { DayRecord } from '../../transcription/value-objects/day-record.vo.js'
import type { PageHolerite } from '../../transcription/value-objects/page-holerite.vo.js'

/**
 * Converte avisos derivados em destaque de linha para a planilha.
 * Quando amarelo (warning) e vermelho (error) se aplicam à mesma linha,
 * o vermelho ganha — formato real de produção.
 */
export const HighlightDetector = {
  cartaoPontoDay(day: DayRecord, isNonSequential: boolean): RowHighlight | null {
    const reasons: string[] = []
    if (day.isOddPunches()) reasons.push('Batidas ímpares')
    if (isNonSequential) reasons.push('Data não sequencial')
    if (day.hasUncertainty()) reasons.push('Leitura incerta (?)')

    if (reasons.length === 0) return null
    if (isNonSequential) return RowHighlight.error(reasons.join('; '))
    return RowHighlight.warning(reasons.join('; '))
  },

  holeritePage(page: PageHolerite, isMonthNonSequential: boolean): RowHighlight | null {
    const reasons: string[] = []
    if (page.isEmpty()) reasons.push('Página vazia')
    if (isMonthNonSequential) reasons.push('Mês não sequencial')
    if (page.hasUncertainty()) reasons.push('Leitura incerta (?)')

    if (reasons.length === 0) return null
    if (isMonthNonSequential) return RowHighlight.error(reasons.join('; '))
    return RowHighlight.warning(reasons.join('; '))
  },
}
