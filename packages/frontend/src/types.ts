export type DocumentType = 'cartao-ponto' | 'holerite'
export type TranscriptionStatus = 'processando' | 'concluido' | 'erro'
export type ExportFormat = 'xlsx' | 'csv' | 'json'

export interface Punch {
  kind: 'IN' | 'OUT'
  time_raw: string
  time_hhmm: string
}

export interface DayRecord {
  date_raw: string
  punches: Punch[]
}

export interface CartaoPontoPage {
  page: number
  days: DayRecord[]
}

export interface PayrollField {
  code: string
  label: string
  reference: string
  value: string
}

export interface PayrollBase {
  label: string
  value: string
}

export interface HoleritePage {
  page: number
  year: string
  month: string
  fields: PayrollField[]
  bases: PayrollBase[]
}

export interface Transcription {
  id: string
  tipo: DocumentType
  status: TranscriptionStatus
  erro: string | null
  value: { pages: (CartaoPontoPage | HoleritePage)[] } | null
}
