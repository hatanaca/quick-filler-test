import { describe, expect, it } from 'vitest'
import {
  SpreadsheetBuilder,
  DocumentType,
  DayRecord,
  PageCartaoPonto,
  PageHolerite,
  PayrollField,
  PayrollBase,
  Punch,
} from '@quickfiller/domain'

const punch = (kind: 'IN' | 'OUT', time: string) =>
  Punch.from({ kind, time_raw: time, time_hhmm: time })

const day = (date_raw: string, punches: Punch[] = []) => DayRecord.from({ date_raw, punches })

describe('SpreadsheetBuilder — cartão de ponto', () => {
  it('gera headers Data + pares Entrada/Saída conforme o dia com mais batidas', () => {
    const result = {
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [
            day('21/05/2019', [punch('IN', '08:00'), punch('OUT', '12:00')]),
            day('22/05/2019', [
              punch('IN', '08:00'),
              punch('OUT', '12:00'),
              punch('IN', '13:00'),
              punch('OUT', '18:00'),
            ]),
          ],
        }),
      ],
    }
    const { headers, rows } = SpreadsheetBuilder.build(result, DocumentType.CARTAO_PONTO)
    expect(headers).toEqual(['Data', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'])
    expect(rows).toHaveLength(2)
  })

  it('uma linha por dia, na ordem do documento', () => {
    const result = {
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [day('21/05/2019'), day('25/05/2019')],
        }),
      ],
    }
    const { rows } = SpreadsheetBuilder.build(result, DocumentType.CARTAO_PONTO)
    expect(rows[0]?.cells[0]).toBe('21/05/2019')
    expect(rows[1]?.cells[0]).toBe('25/05/2019')
  })

  it('células sem batida ficam vazias', () => {
    const result = {
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [
            day('21/05/2019', [punch('IN', '08:00'), punch('OUT', '12:00')]),
            day('22/05/2019'),
          ],
        }),
      ],
    }
    const { rows } = SpreadsheetBuilder.build(result, DocumentType.CARTAO_PONTO)
    expect(rows[1]?.cells).toEqual(['22/05/2019', null, null])
  })

  it('aplica destaque amarelo para batidas ímpares', () => {
    const result = {
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [day('21/05/2019', [punch('IN', '08:00'), punch('OUT', '12:00'), punch('IN', '13:00')])],
        }),
      ],
    }
    const { rows } = SpreadsheetBuilder.build(result, DocumentType.CARTAO_PONTO)
    expect(rows[0]?.highlight?.type).toBe('warning')
    expect(rows[0]?.highlight?.backgroundColor).toBe('#FFF3CD')
  })

  it('aplica destaque vermelho para data não sequencial', () => {
    const result = {
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [day('20/05/2019'), day('25/05/2019')],
        }),
      ],
    }
    const { rows } = SpreadsheetBuilder.build(result, DocumentType.CARTAO_PONTO)
    expect(rows[1]?.highlight?.type).toBe('error')
    expect(rows[1]?.highlight?.leftBorderColor).toBe('#DC3545')
  })
})

describe('SpreadsheetBuilder — holerite', () => {
  const makeResult = () => ({
    pages: [
      PageHolerite.from({
        page: 1,
        year: '2020',
        month: '01',
        fields: [
          PayrollField.from({ code: '0010', label: 'Salário Base', reference: '220,00', value: '2.389,77' }),
          PayrollField.from({ code: '5560', label: 'Horas Extras - 50%', reference: '8,00', value: '155,91' }),
        ],
        bases: [PayrollBase.from({ label: 'Base INSS', value: '2.545,68' })],
      }),
      PageHolerite.from({
        page: 2,
        year: '2020',
        month: '02',
        fields: [
          PayrollField.from({ code: '5560', label: 'Horas Extras - 50%', reference: '4,00', value: '77,95' }),
        ],
        bases: [],
      }),
    ],
  })

  it('headers: Pág., Mês, Ano + uma coluna por verba distinta na ordem de primeira aparição', () => {
    const { headers } = SpreadsheetBuilder.build(makeResult(), DocumentType.HOLERITE)
    expect(headers).toEqual(['Pág.', 'Mês', 'Ano', 'Salário Base', 'Horas Extras - 50%'])
  })

  it('uma linha por página; célula vazia quando a verba não aparece', () => {
    const { rows } = SpreadsheetBuilder.build(makeResult(), DocumentType.HOLERITE)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells).toEqual(['1', '01', '2020', '2.389,77', '155,91'])
    expect(rows[1]?.cells).toEqual(['2', '02', '2020', null, '77,95'])
  })

  it('aplica destaque amarelo para página vazia', () => {
    const result = {
      pages: [
        PageHolerite.from({ page: 1, year: '2020', month: '01', fields: [], bases: [] }),
      ],
    }
    const { rows } = SpreadsheetBuilder.build(result, DocumentType.HOLERITE)
    expect(rows[0]?.highlight?.type).toBe('warning')
  })

  it('aplica destaque vermelho para mês não sequencial', () => {
    const result = {
      pages: [
        PageHolerite.from({
          page: 1,
          year: '2020',
          month: '01',
          fields: [PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value: '2.389,77' })],
          bases: [],
        }),
        PageHolerite.from({
          page: 2,
          year: '2020',
          month: '03',
          fields: [PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value: '2.389,77' })],
          bases: [],
        }),
      ],
    }
    const { rows } = SpreadsheetBuilder.build(result, DocumentType.HOLERITE)
    expect(rows[1]?.highlight?.type).toBe('error')
  })
})
