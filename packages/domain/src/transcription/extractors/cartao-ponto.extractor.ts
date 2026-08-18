import { normalizeText, twoDigits } from '../../shared/utils/text-utils.js'
import { DayRecord } from '../value-objects/day-record.vo.js'
import { PageCartaoPonto } from '../value-objects/page-cartao-ponto.vo.js'
import { Punch } from '../value-objects/punch.vo.js'
import type { CartaoPontoResult } from '../value-objects/transcription-result.vo.js'
import type { DocumentExtractor } from './extractor-registry.js'

const DATE_RE = /([0-9?]{2}\/[0-9?]{2}\/[0-9?]{4})/g
const TIME_RE = /([0-9?]{1,2}:[0-9?]{2})/g

/** Célula inteira que é um horário (colunas Entrada/Saída/Qtde do SIPON). */
const CELL_TIME_RE = /^[0-9?]{1,2}:[0-9?]{2}$/

/** Normaliza "8:25" → "08:25"; preserva "?" de incerteza. */
function normalizeTime(raw: string): string {
  const [hour, minute] = raw.split(':')
  if (!hour || !minute) return raw
  const normalized = `${hour.padStart(2, '0')}:${minute}`
  const h = Number(hour.replace('?', '0'))
  if (h > 23) return '??:??'
  return normalized
}

const SIPON_MES_ANO_RE = /Mes\/Ano\s*:\s*(\d{1,2})\s*\/\s*(\d{4})/
const DAY_MARKER_RE = /^\s*(\d{1,2})\s*-\s*[A-Z]{2,3}\b/

// Banco do Brasil: "DD WWW [ocorrência] [EntradaSaida HH:MM-HH:MM] [intervalos]..."
const BB_MES_ANO_RE = /M[eê]s\/Ano\s*:\s*(\d{1,2})\/(\d{4})/
const BB_DAY_RE = /^\s*(\d{1,2})[-\s]*([A-Z]{2,3})\b/
const BB_RANGE_RE = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:?\d{2})/

interface SiponDay {
  day: number
  punches: Punch[]
}

/** Normaliza "18:15" e "1815" (OCR sem o ":") → "18:15". */
function normalizeRangeTime(raw: string): string {
  const t = raw.trim()
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const normalized = normalizeTime(t)
    const [hour] = normalized.split(':')
    if (Number(hour) > 23) return '??:??'
    return normalized
  }
  if (/^\d{3,4}$/.test(t)) {
    const hour = t.length === 4 ? t.slice(0, 2) : t.slice(0, 1)
    const minute = t.slice(-2)
    if (Number(hour) > 23) return '??:??'
    return `${hour.padStart(2, '0')}:${minute}`
  }
  return t
}

/**
 * Extrai cartão de ponto do texto (pdf-parse ou OCR).
 *
 * Três layouts:
 * - "padrão": uma linha = um dia, com data `dd/mm/yyyy` e batidas na mesma
 *   linha (IN/OUT alternados).
 * - "SIPON" (FOLHA DE FREQUÊNCIA): a data é reconstruída do número do dia +
 *   `Mes/Ano` do cabeçalho; batidas em várias linhas; Jornada e Qtde ignoradas.
 * - "Banco do Brasil" (PONTO ELETRÔNICO): data reconstruída de dia + `Mês/Ano`;
 *   a batida é o primeiro intervalo `HH:MM-HH:MM` (EntradaSaida); intervalos
 *   de almoço são ignorados.
 */
export const CartaoPontoExtractor: DocumentExtractor = {
  extract(pagesText: string[]): CartaoPontoResult {
    const pages = pagesText.map((text, index) => {
      const n = normalizeText(text)
      if (n.includes('bancodobrasil') || n.includes('relatoriomensal')) {
        return extractBancoDoBrasilPage(text, index)
      }
      if (isSipon(text)) return extractSiponPage(text, index)
      return extractStandardPage(text, index)
    })
    return { kind: 'cartao-ponto', pages: removeRepeatedHeaderDates(pages) }
  },
}

/**
 * Remove datas de cabeçalho/rodapé que aparecem em múltiplas páginas sem
 * batidas. PDFs reais frequentemente trazem a data de emissão ou referência
 * no topo/rodapé de cada página — sem esse filtro, essas datas viram linhas
 * fantasmas repetidas na saída.
 */
function removeRepeatedHeaderDates(pages: PageCartaoPonto[]): PageCartaoPonto[] {
  if (pages.length <= 1) return pages

  const noPunchCount = new Map<string, number>()
  for (const page of pages) {
    for (const day of page.days) {
      if (day.punches.length === 0) {
        noPunchCount.set(day.date_raw, (noPunchCount.get(day.date_raw) ?? 0) + 1)
      }
    }
  }

  const toRemove = new Set(
    [...noPunchCount.entries()].filter(([, count]) => count >= 3).map(([d]) => d),
  )

  return pages.map((page) => ({
    ...page,
    days: page.days.filter((day) => {
      if (day.punches.length > 0) return true
      return !toRemove.has(day.date_raw)
    }),
  }))
}

function isSipon(pageText: string): boolean {
  return /Mes\/Ano/i.test(pageText) || /FOLHA DE FREQUENCIA/i.test(pageText)
}

function extractBancoDoBrasilPage(text: string, index: number): PageCartaoPonto {
  let month = 0
  let year = 0
  const m = BB_MES_ANO_RE.exec(text)
  if (m) {
    const parsed = Number(m[1])
    month = parsed >= 1 && parsed <= 12 ? parsed : 0
    year = Number(m[2])
  }

  const days: DayRecord[] = []
  for (const line of text.split('\n')) {
    const dayMatch = BB_DAY_RE.exec(line)
    if (!dayMatch) continue
    const dayNumber = Number(dayMatch[1])

    const range = BB_RANGE_RE.exec(line)
    const punches =
      range && range[1] && range[2]
        ? [
            Punch.from({ kind: 'IN', time_raw: range[1], time_hhmm: normalizeTime(range[1]) }),
            Punch.from({
              kind: 'OUT',
              time_raw: range[2],
              time_hhmm: normalizeRangeTime(range[2]),
            }),
          ]
        : []

    const date_raw =
      month > 0 && year > 0
        ? `${twoDigits(dayNumber)}/${twoDigits(month)}/${year}`
        : `${twoDigits(dayNumber)}/?/????`

    days.push(DayRecord.from({ date_raw, punches }))
  }
  return PageCartaoPonto.from({ page: index + 1, days })
}

function extractStandardPage(text: string, index: number): PageCartaoPonto {
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
}

function extractSiponPage(text: string, index: number): PageCartaoPonto {
  let month = 0
  let year = 0
  for (const line of text.split('\n')) {
    const match = SIPON_MES_ANO_RE.exec(line)
    if (match) {
      const parsed = Number(match[1])
      month = parsed >= 1 && parsed <= 12 ? parsed : 0
      year = Number(match[2])
      break
    }
  }

  const days: DayRecord[] = []
  let current: SiponDay | null = null

  const pushCurrent = () => {
    if (current) days.push(buildSiponDay(current, month, year))
    current = null
  }

  // A palavra de ocorrência e sua Qtde (duração) ficam na MESMA linha — o
  // flag de "próximo horário é Qtde" é local a cada linha, senão uma
  // ocorrência sem duração (DESTACAMENTO) engoliria a primeira batida da
  // linha seguinte.
  const addPunches = (day: SiponDay, cells: string[]) => {
    let skipNextTime = false
    for (const cell of cells) {
      const time = CELL_TIME_RE.exec(cell)
      if (time) {
        if (skipNextTime) {
          skipNextTime = false
          continue
        }
        const raw = time[0]
        day.punches.push(
          Punch.from({
            kind: day.punches.length % 2 === 0 ? 'IN' : 'OUT',
            time_raw: raw,
            time_hhmm: normalizeTime(raw),
          }),
        )
      } else {
        skipNextTime = true
      }
    }
  }

  for (const line of text.split('\n')) {
    const cells = line
      .split('\t')
      .map((c) => c.trim())
      .filter((c) => c !== '')
    if (cells.length === 0) continue

    const marker = DAY_MARKER_RE.exec(cells[0] ?? '')
    if (marker) {
      const dayNumber = Number(marker[1])
      // Linha de dia repetida (batidas que não couberam) repete o marcador e a
      // jornada — não cria um novo dia.
      if (!current || current.day !== dayNumber) {
        pushCurrent()
        current = { day: dayNumber, punches: [] }
      }
      // Descarta o marcador (cells[0]) e a Jornada (cells[1]).
      addPunches(current, cells.slice(2))
    } else if (current) {
      addPunches(current, cells)
    }
  }
  pushCurrent()

  return PageCartaoPonto.from({ page: index + 1, days })
}

function buildSiponDay(day: SiponDay, month: number, year: number): DayRecord {
  const date_raw =
    month > 0 && year > 0
      ? `${twoDigits(day.day)}/${twoDigits(month)}/${year}`
      : `${twoDigits(day.day)}/?/????`

  return DayRecord.from({
    date_raw,
    punches: day.punches,
  })
}
