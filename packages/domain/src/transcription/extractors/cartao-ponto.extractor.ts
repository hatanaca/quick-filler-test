import { DayRecord } from '../value-objects/day-record.vo.js'
import { PageCartaoPonto } from '../value-objects/page-cartao-ponto.vo.js'
import { Punch } from '../value-objects/punch.vo.js'
import type { CartaoPontoResult } from '../value-objects/transcription-result.vo.js'
import type { DocumentExtractor } from './extractor-registry.js'

const DATE_RE = /([0-9?]{2}\/[0-9?]{2}\/[0-9?]{4})/g
const TIME_RE = /([0-9?]{1,2}:[0-9?]{2})/g

/** Normaliza "8:25" → "08:25"; preserva "?" de incerteza. */
function normalizeTime(raw: string): string {
  const [hour, minute] = raw.split(':')
  if (!hour || !minute) return raw
  return `${hour.padStart(2, '0')}:${minute}`
}

/**
 * Extrai cartão de ponto do texto (pdf-parse ou OCR).
 * Uma linha = um dia; batidas em pares IN/OUT na ordem do documento.
 * Nunca inventa valor: caracteres ilegíveis permanecem como '?'.
 */
export const CartaoPontoExtractor: DocumentExtractor = {
  extract(pagesText: string[]): CartaoPontoResult {
    const pages = pagesText.map((text, index) => {
      const days: DayRecord[] = []

      for (const line of text.split('\n')) {
        const dateMatch = line.match(DATE_RE)
        if (!dateMatch) continue

        const date_raw = dateMatch[0] ?? ''
        const times = [...line.matchAll(TIME_RE)].map((m) => m[1] ?? '')
        const punches = times.map((time_raw, i) =>
          Punch.from({
            kind: i % 2 === 0 ? 'IN' : 'OUT',
            time_raw,
            time_hhmm: normalizeTime(time_raw),
          }),
        )
        days.push(DayRecord.from({ date_raw, punches }))
      }

      return PageCartaoPonto.from({ page: index + 1, days })
    })

    return { pages }
  },
}
