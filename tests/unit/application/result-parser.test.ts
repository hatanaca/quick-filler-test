import { describe, expect, it } from 'vitest'
import { parseResult } from '@quickfiller/application'
import { DocumentType } from '@quickfiller/domain'

describe('parseResult — cartão de ponto', () => {
  const valid = {
    pages: [
      {
        page: 1,
        days: [
          {
            date_raw: '21/05/2019',
            punches: [
              { kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' },
              { kind: 'OUT', time_raw: '18:25', time_hhmm: '18:25' },
            ],
          },
        ],
      },
    ],
  }

  it('converte JSON válido em resultado de domínio', () => {
    const result = parseResult(DocumentType.CARTAO_PONTO, valid)
    const page = result.pages[0]
    if (!page || !('days' in page)) throw new Error('esperava página de cartão de ponto')
    expect(page.days[0]?.date_raw).toBe('21/05/2019')
    expect(page.days[0]?.punches).toHaveLength(2)
  })

  it('rejeita kind inválido', () => {
    const bad = structuredClone(valid) as typeof valid
    bad.pages[0]!.days[0]!.punches[0]!.kind = 'MIDDLE'
    expect(() => parseResult(DocumentType.CARTAO_PONTO, bad)).toThrow(/kind/)
  })

  it('aceita data válida', () => {
    const bad = structuredClone(valid) as typeof valid
    bad.pages[0]!.days[0]!.date_raw = '21/05/2019'
    expect(() => parseResult(DocumentType.CARTAO_PONTO, bad)).not.toThrow()
  })

  it('rejeita shape inválido (sem pages)', () => {
    expect(() => parseResult(DocumentType.CARTAO_PONTO, {})).toThrow(/pages/)
  })
})

describe('parseResult — holerite', () => {
  const valid = {
    pages: [
      {
        page: 1,
        year: '2020',
        month: '01',
        fields: [{ code: '0010', label: 'Salário Base', reference: '220,00', value: '2.389,77' }],
        bases: [{ label: 'Base INSS', value: '2.545,68' }],
      },
    ],
  }

  it('converte JSON válido em resultado de domínio', () => {
    const result = parseResult(DocumentType.HOLERITE, valid)
    const page = result.pages[0]
    if (!page || !('fields' in page)) throw new Error('esperava página de holerite')
    expect(page.fields[0]?.label).toBe('Salário Base')
    expect(page.bases[0]?.value).toBe('2.545,68')
  })

  it('rejeita mês inválido (13)', () => {
    const bad = structuredClone(valid) as typeof valid
    bad.pages[0]!.month = '13'
    expect(() => parseResult(DocumentType.HOLERITE, bad)).toThrow(/month/)
  })

  it('rejeita value float no field', () => {
    const bad = structuredClone(valid) as typeof valid
    bad.pages[0]!.fields[0]!.value = '2389.77'
    expect(() => parseResult(DocumentType.HOLERITE, bad)).toThrow(/value/)
  })
})
