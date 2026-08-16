import type { PageHolerite } from '../value-objects/page-holerite.vo.js'
import type { HoleriteResult } from '../value-objects/transcription-result.vo.js'
import type { DocumentExtractor } from './extractor-registry.js'
import { parseStandard } from './holerite/standard.js'
import { parseDemonstrativo } from './holerite/demonstrativo.js'
import { parseDeclaracaoRemuneracao } from './holerite/declaracao-remuneracao.js'
import { parseFichaFinanceira } from './holerite/ficha-financeira.js'
import { parseReciboPagamento } from './holerite/recibo-pagamento.js'

type LayoutParser = (text: string, pageIndex: number) => PageHolerite[]

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function detectLayout(text: string): LayoutParser {
  const n = normalize(text)
  // A ficha financeira só traz o cabeçalho "FICHAFINANCEIRA" na 1ª página —
  // páginas seguintes são reconhecidas pelos rótulos/totais característicos.
  if (
    n.includes('fichafinanceira') ||
    n.includes('folhanormal') ||
    n.includes('totrendimentos') ||
    n.includes('salarioliquidonomes') ||
    n.includes('basedecalculo') ||
    n.includes('remuneracaomes')
  ) {
    return parseFichaFinanceira
  }
  if (n.includes('pagamentomensal') || n.includes('demonstrativodepagamento')) {
    return parseDemonstrativo
  }
  if (n.includes('declaracaoremuneracao')) return parseDeclaracaoRemuneracao
  if (n.includes('recibodepagamento')) return parseReciboPagamento
  return parseStandard
}

/**
 * Extrai holerite do texto (pdf-parse ou OCR), detectando o layout por página
 * e despachando para o parser específico. Um mesmo `page` pode gerar várias
 * entradas (ficha financeira e Declaração Remuneração têm múltiplas
 * competências por página).
 *
 * Regras centrais (ver docs/API.md):
 * - value = último valor monetário; reference = penúltimo, quando houver
 * - label sem código; code/reference vazios quando ausentes
 * - fields = verbas da tabela principal; bases = seção separada — nunca confundir
 * - valores monetários são string no formato brasileiro, nunca float
 */
export const HoleriteExtractor: DocumentExtractor = {
  extract(pagesText: string[]): HoleriteResult {
    const pages = pagesText.flatMap((text, index) => detectLayout(text)(text, index))
    return { pages }
  },
}
