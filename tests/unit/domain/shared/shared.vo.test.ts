import { describe, expect, it } from 'vitest'
import {
  CellStyle,
  TranscriptionId,
  DocumentType,
  isDocumentType,
  TranscriptionStatus,
  isTranscriptionStatus,
  parseDateRaw,
} from '@quickfiller/domain'

describe('CellStyle', () => {
  it('header usa negrito branco sobre #173772', () => {
    const style = CellStyle.header()
    expect(style.bold).toBe(true)
    expect(style.color).toBe('#FFFFFF')
    expect(style.backgroundColor).toBe('#173772')
  })
})

describe('TranscriptionId', () => {
  it('cria id a partir de UUID válido', () => {
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    expect(id.value).toBe('00000000-0000-4000-8000-000000000001')
  })

  it('rejeita id vazia', () => {
    expect(() => TranscriptionId.from('')).toThrow(/id/)
  })

  it('rejeita id que não é UUID (path traversal)', () => {
    expect(() => TranscriptionId.from('../../etc/passwd')).toThrow(/UUID/)
  })
})

describe('DocumentType', () => {
  it('tem os valores literais do contrato', () => {
    expect(DocumentType.CARTAO_PONTO).toBe('cartao-ponto')
    expect(DocumentType.HOLERITE).toBe('holerite')
  })

  it('isDocumentType valida os dois tipos', () => {
    expect(isDocumentType('cartao-ponto')).toBe(true)
    expect(isDocumentType('holerite')).toBe(true)
    expect(isDocumentType('invalido')).toBe(false)
    expect(isDocumentType('')).toBe(false)
  })
})

describe('parseDateRaw', () => {
  it('aceita data válida', () => {
    const result = parseDateRaw('15/03/2023')
    expect(result.status).toBe('readable')
  })

  it('marca ilegível quando contém "?"', () => {
    expect(parseDateRaw('1?/03/2023').status).toBe('unreadable')
  })

  it('marca impossível dia fora do mês (31/02)', () => {
    expect(parseDateRaw('31/02/2023').status).toBe('impossible')
  })

  it('marca impossível 29/02 em ano não bissexto', () => {
    expect(parseDateRaw('29/02/2023').status).toBe('impossible')
  })

  it('aceita 29/02 em ano bissexto', () => {
    expect(parseDateRaw('29/02/2024').status).toBe('readable')
  })

  it('marca impossível mês fora do range', () => {
    expect(parseDateRaw('01/13/2023').status).toBe('impossible')
  })
})

describe('TranscriptionStatus', () => {
  it('tem os três status literais do contrato', () => {
    expect(TranscriptionStatus.PROCESSANDO).toBe('processando')
    expect(TranscriptionStatus.CONCLUIDO).toBe('concluido')
    expect(TranscriptionStatus.ERRO).toBe('erro')
  })

  it('isTranscriptionStatus valida os três status', () => {
    expect(isTranscriptionStatus('processando')).toBe(true)
    expect(isTranscriptionStatus('concluido')).toBe(true)
    expect(isTranscriptionStatus('erro')).toBe(true)
    expect(isTranscriptionStatus('pendente')).toBe(false)
  })
})
