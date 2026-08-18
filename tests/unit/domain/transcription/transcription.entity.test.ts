import { describe, expect, it } from 'vitest'
import {
  Transcription,
  TranscriptionId,
  DocumentType,
  TranscriptionStatus,
  DayRecord,
  PageCartaoPonto,
} from '@quickfiller/domain'

const tipo = DocumentType.CARTAO_PONTO

describe('Transcription', () => {
  it('cria com status PROCESSANDO', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    expect(t.status).toBe(TranscriptionStatus.PROCESSANDO)
    expect(t.value).toBeNull()
    expect(t.erro).toBeNull()
  })

  it('cria com createdAt e updatedAt', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    expect(t.createdAt).toBeInstanceOf(Date)
    expect(t.updatedAt).toBeInstanceOf(Date)
  })

  it('emite evento TranscriptionCreated ao criar', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    const events = t.pullEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('transcription.created')
  })

  it('transição PROCESSANDO → CONCLUIDO', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    const result = {
      kind: 'cartao-ponto' as const,
      pages: [PageCartaoPonto.from({ page: 1, days: [] })],
    }
    t.complete(result)
    expect(t.status).toBe(TranscriptionStatus.CONCLUIDO)
    expect(t.value).toEqual(result)
  })

  it('emite evento TranscriptionCompleted ao completar', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    t.complete({ kind: 'cartao-ponto', pages: [PageCartaoPonto.from({ page: 1, days: [] })] })
    const events = t.pullEvents()
    expect(events.some((e) => e.type === 'transcription.completed')).toBe(true)
  })

  it('transição PROCESSANDO → ERRO', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    t.fail('PDF corrompido')
    expect(t.status).toBe(TranscriptionStatus.ERRO)
    expect(t.erro).toBe('PDF corrompido')
  })

  it('emite evento TranscriptionFailed ao falhar', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    t.fail('timeout')
    expect(t.pullEvents().some((e) => e.type === 'transcription.failed')).toBe(true)
  })

  it('rejeita transição ERRO → CONCLUIDO', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    t.fail('timeout')
    expect(() => t.complete({ kind: 'cartao-ponto', pages: [] })).toThrow(/transição|status/)
  })

  it('rejeita transição CONCLUIDO → ERRO', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    t.complete({ kind: 'cartao-ponto', pages: [] })
    expect(() => t.fail('x')).toThrow(/transição|status/)
  })

  it('rejeita fail com mensagem vazia', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    expect(() => t.fail('')).toThrow(/erro/)
  })

  it('updateValue substitui value quando concluído', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    const original = {
      kind: 'cartao-ponto' as const,
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [DayRecord.from({ date_raw: '21/05/2019', punches: [] })],
        }),
      ],
    }
    t.complete(original)
    const corrigido = {
      kind: 'cartao-ponto' as const,
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [DayRecord.from({ date_raw: '22/05/2019', punches: [] })],
        }),
      ],
    }
    t.updateValue(corrigido)
    expect(t.value).toEqual(corrigido)
  })

  it('rejeita updateValue enquanto processando', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    expect(() => t.updateValue({ kind: 'cartao-ponto', pages: [] })).toThrow(/concluído|status/)
  })

  it('rejeita updateValue quando em erro', () => {
    const t = Transcription.create({
      id: TranscriptionId.from('00000000-0000-4000-8000-000000000001'),
      tipo,
    })
    t.fail('timeout')
    expect(() => t.updateValue({ kind: 'cartao-ponto', pages: [] })).toThrow(/concluído|status/)
  })
})
