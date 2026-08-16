import { PageHolerite } from '../value-objects/page-holerite.vo.js'
import { PayrollBase } from '../value-objects/payroll-base.vo.js'
import { PayrollField } from '../value-objects/payroll-field.vo.js'
import type { HoleriteResult } from '../value-objects/transcription-result.vo.js'
import type { DocumentExtractor } from './extractor-registry.js'

const COMPETENCIA_RE = /(?:Compet[eê]ncia|referente a|compet[eê]ncia)\s*[:.]?\s*(\d{2})\/(\d{4})/i
const FIELD_RE = /^(\d{4})\s+(.+)$/
// '?' representa incerteza de OCR por caractere; sem ele, valores parciais
// (ex.: "2.38?,77") escapam do match e corrompem label/value.
const MONEY_RE = /[0-9?]{1,3}(?:[.][0-9?]{3})*,[0-9?]{1,2}/g
const BASE_LABELS = [
  'Base INSS',
  'Base IR',
  'FGTS',
  'Total Vencimentos',
  'Total Descontos',
  'Valor Líquido',
  'Base FGTS',
  'Salário Contribuição',
]

/**
 * Extrai holerite do texto (pdf-parse ou OCR).
 *
 * Linha típica de verba: "0010 Salário Base   220,00  2.389,77"
 *   - code = primeiro token de 4 dígitos
 *   - value = ÚLTIMO valor monetário da linha (2.389,77)
 *   - reference = penúltimo valor monetário, se houver (220,00)
 *   - label = texto entre code e reference, sem o code
 *
 * fields = verbas da tabela principal; bases = seção separada abaixo
 * da tabela (Base INSS, Valor Líquido, ...). A separação fields/bases
 * é a decisão central — nunca confundir.
 */
export const HoleriteExtractor: DocumentExtractor = {
  extract(pagesText: string[]): HoleriteResult {
    const pages = pagesText.map((text, index) => {
      const competenceMatch = text.match(COMPETENCIA_RE)
      const year = competenceMatch?.[2] ?? '????'
      const month = competenceMatch?.[1] ?? '0?'

      const fields: PayrollField[] = []
      const bases: PayrollBase[] = []

      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Base da seção separada: label conhecida + valor monetário no fim
        const baseLabel = BASE_LABELS.find((label) => trimmed.startsWith(label))
        if (baseLabel) {
          const value = lastMoney(trimmed)
          if (value) {
            bases.push(PayrollBase.from({ label: baseLabel, value }))
            continue
          }
        }

        // Verba da tabela principal: começa com código de 4 dígitos
        const fieldMatch = trimmed.match(FIELD_RE)
        if (!fieldMatch) continue
        const rest = fieldMatch[2] ?? ''
        const moneys = [...rest.matchAll(MONEY_RE)].map((m) => m[0] ?? '')
        if (moneys.length === 0) continue

        // value = último; reference = penúltimo (coluna QTDE/REF)
        const value = moneys[moneys.length - 1] ?? ''
        const reference = moneys.length > 1 ? (moneys[moneys.length - 2] ?? '') : ''

        // label = texto entre code e reference, sem os valores monetários
        // e sem o traço "-" que representa referência vazia no documento
        const label = rest
          .replace(MONEY_RE, '')
          .replace(/-\s*$/, '')
          .trim()
          .replace(/\s{2,}/g, ' ')

        if (label) {
          fields.push(PayrollField.from({ code: fieldMatch[1] ?? '', label, reference, value }))
        }
      }

      return PageHolerite.from({ page: index + 1, year, month, fields, bases })
    })

    return { pages }
  },
}

function lastMoney(line: string): string | null {
  const moneys = [...line.matchAll(MONEY_RE)].map((m) => m[0] ?? '')
  return moneys.length > 0 ? (moneys[moneys.length - 1] ?? null) : null
}
