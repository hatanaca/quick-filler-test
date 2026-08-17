import { normalizeText } from '../../shared/utils/text-utils.js'
import { PageHolerite } from '../value-objects/page-holerite.vo.js'
import type { HoleriteResult } from '../value-objects/transcription-result.vo.js'
import type { DocumentExtractor } from './extractor-registry.js'
import { parseStandard } from './holerite/standard.js'
import { parseDemonstrativo } from './holerite/demonstrativo.js'
import { parseDeclaracaoRemuneracao } from './holerite/declaracao-remuneracao.js'
import { parseFichaFinanceira } from './holerite/ficha-financeira.js'
import { parseReciboPagamento } from './holerite/recibo-pagamento.js'

type LayoutParser = (text: string, pageIndex: number) => PageHolerite[]

function detectLayout(text: string): LayoutParser {
  const n = normalizeText(text)
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
    const raw = pagesText.flatMap((text, index) => detectLayout(text)(text, index))
    return { pages: mergeDuplicateEntries(raw) }
  },
}

/**
 * Mescla entradas com o mesmo page+month+year quando seus campos se
 * sobrepõem (mesmo label). PDFs com seções de continuação (ex.:
 * rendimentos na metade superior, descontos/resultados na inferior)
 * geram duas entradas para o mesmo mês com campos complementares.
 * Seções legítimas (MÊS vs ACERTO na Declaração Remuneração) não
 * compartilham labels e ficam separadas.
 */
function mergeDuplicateEntries(pages: PageHolerite[]): PageHolerite[] {
  const merged: PageHolerite[] = []
  const seen = new Map<string, number>()

  for (const page of pages) {
    const key = `${page.page}|${page.month}|${page.year}`
    const existingIndex = seen.get(key)
    if (existingIndex !== undefined) {
      const existing = merged[existingIndex]!
      const existingLabels = new Set(existing.fields.map((f) => f.label))
      const hasOverlap = page.fields.some((f) => existingLabels.has(f.label))

      if (hasOverlap) {
        merged[existingIndex] = PageHolerite.from({
          page: existing.page,
          year: existing.year,
          month: existing.month,
          fields: [...existing.fields, ...page.fields],
          bases: [...existing.bases, ...page.bases],
        })
        continue
      }
    }

    seen.set(key, merged.length)
    merged.push(page)
  }

  return merged
}
