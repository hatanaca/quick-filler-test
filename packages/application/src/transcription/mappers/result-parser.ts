import {
  DayRecord,
  DomainError,
  PageCartaoPonto,
  PageHolerite,
  PayrollBase,
  PayrollField,
  Punch,
  type DocumentType,
  type TranscriptionResult,
} from '@quickfiller/domain'

interface JsonPunch {
  kind?: unknown
  time_raw?: unknown
  time_hhmm?: unknown
}

interface JsonDay {
  date_raw?: unknown
  punches?: JsonPunch[]
}

interface JsonPageCartao {
  page?: unknown
  days?: JsonDay[]
}

interface JsonField {
  code?: unknown
  label?: unknown
  reference?: unknown
  value?: unknown
}

interface JsonBase {
  label?: unknown
  value?: unknown
}

interface JsonPageHolerite {
  page?: unknown
  year?: unknown
  month?: unknown
  fields?: JsonField[]
  bases?: JsonBase[]
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new DomainError(`campo "${field}" deve ser string`)
  }
  return value
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DomainError(`campo "${field}" deve ser inteiro`)
  }
  return value
}

function parseCartao(value: unknown): TranscriptionResult {
  if (!value || typeof value !== 'object' || !('pages' in value) || !Array.isArray(value.pages)) {
    throw new DomainError('value deve conter "pages" como array')
  }
  const pages = (value.pages as JsonPageCartao[]).map((jsonPage) => {
    const page = asNumber(jsonPage.page, 'page')
    if (!Array.isArray(jsonPage.days)) {
      throw new DomainError('campo "days" deve ser array')
    }
    const days = jsonPage.days.map((jsonDay) => {
      const date_raw = asString(jsonDay.date_raw, 'date_raw')
      const punches = (jsonDay.punches ?? []).map((jsonPunch) =>
        Punch.from({
          kind: asString(jsonPunch.kind, 'kind'),
          time_raw: asString(jsonPunch.time_raw, 'time_raw'),
          time_hhmm: asString(jsonPunch.time_hhmm, 'time_hhmm'),
        }),
      )
      return DayRecord.from({ date_raw, punches })
    })
    return PageCartaoPonto.from({ page, days })
  })
  return { kind: 'cartao-ponto', pages }
}

function parseHolerite(value: unknown): TranscriptionResult {
  if (!value || typeof value !== 'object' || !('pages' in value) || !Array.isArray(value.pages)) {
    throw new DomainError('value deve conter "pages" como array')
  }
  const pages = (value.pages as JsonPageHolerite[]).map((jsonPage) => {
    const page = asNumber(jsonPage.page, 'page')
    const year = asString(jsonPage.year, 'year')
    const month = asString(jsonPage.month, 'month')
    const fields = (jsonPage.fields ?? []).map((f) =>
      PayrollField.from({
        code: asString(f.code, 'code'),
        label: asString(f.label, 'label'),
        reference: asString(f.reference, 'reference'),
        value: asString(f.value, 'value'),
      }),
    )
    const bases = (jsonPage.bases ?? []).map((b) =>
      PayrollBase.from({
        label: asString(b.label, 'label'),
        value: asString(b.value, 'value'),
      }),
    )
    return PageHolerite.from({ page, year, month, fields, bases })
  })
  return { kind: 'holerite', pages }
}

/** Converte JSON vindo do PUT /api/transcricoes em resultado de domínio validado. */
export function parseResult(tipo: DocumentType, value: unknown): TranscriptionResult {
  if (tipo === 'cartao-ponto') return parseCartao(value)
  return parseHolerite(value)
}
