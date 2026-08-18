import type {
  CartaoPontoResult,
  DayRecord,
  HoleriteResult,
  PageCartaoPonto,
  PageHolerite,
  Punch,
  Transcription,
  TranscriptionResult,
} from '@quickfiller/domain'

export interface TranscriptionResponse {
  id: string
  tipo: string
  status: string
  erro: string | null
  value: unknown
}

interface JsonCartaoPonto {
  pages: {
    page: number
    days: {
      date_raw: string
      punches: { kind: string; time_raw: string; time_hhmm: string }[]
    }[]
  }[]
}

interface JsonHolerite {
  pages: {
    page: number
    year: string
    month: string
    fields: { code: string; label: string; reference: string; value: string }[]
    bases: { label: string; value: string }[]
  }[]
}

function cartaoToJson(result: CartaoPontoResult): JsonCartaoPonto {
  return {
    pages: result.pages.map((page: PageCartaoPonto) => ({
      page: page.page,
      days: page.days.map((day: DayRecord) => ({
        date_raw: day.date_raw,
        punches: day.punches.map((punch: Punch) => ({
          kind: punch.kind,
          time_raw: punch.time_raw,
          time_hhmm: punch.time_hhmm,
        })),
      })),
    })),
  }
}

function holeriteToJson(result: HoleriteResult): JsonHolerite {
  return {
    pages: result.pages.map((page: PageHolerite) => ({
      page: page.page,
      year: page.year,
      month: page.month,
      fields: page.fields.map((f) => ({
        code: f.code,
        label: f.label,
        reference: f.reference,
        value: f.value,
      })),
      bases: page.bases.map((b) => ({ label: b.label, value: b.value })),
    })),
  }
}

function serializeValue(value: TranscriptionResult): unknown {
  if (value.kind === 'cartao-ponto') {
    return cartaoToJson(value)
  }
  return holeriteToJson(value)
}

export function toResponse(transcription: Transcription): TranscriptionResponse {
  return {
    id: transcription.id.value,
    tipo: transcription.tipo,
    status: transcription.status,
    erro: transcription.erro,
    value: transcription.value ? serializeValue(transcription.value) : null,
  }
}
