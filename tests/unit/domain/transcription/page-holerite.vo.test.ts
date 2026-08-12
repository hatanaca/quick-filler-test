import { describe, expect, it } from 'vitest'
import { PageHolerite, PayrollBase, PayrollField } from '@quickfiller/domain'

describe('PageHolerite', () => {
  it('cria página com year, month, fields e bases', () => {
    const page = PageHolerite.from({
      page: 1,
      year: '2020',
      month: '01',
      fields: [PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value: '2.389,77' })],
      bases: [PayrollBase.from({ label: 'Base INSS', value: '2.545,68' })],
    })
    expect(page.page).toBe(1)
    expect(page.year).toBe('2020')
    expect(page.month).toBe('01')
  })

  it('rejeita mês fora do range 01-12', () => {
    expect(() =>
      PageHolerite.from({
        page: 1,
        year: '2020',
        month: '13',
        fields: [],
        bases: [],
      }),
    ).toThrow(/month/)
  })

  it('rejeita mês sem zero à esquerda', () => {
    expect(() =>
      PageHolerite.from({
        page: 1,
        year: '2020',
        month: '1',
        fields: [],
        bases: [],
      }),
    ).toThrow(/month/)
  })

  it('aceita mês 12 com zero à esquerda', () => {
    const page = PageHolerite.from({
      page: 1,
      year: '2020',
      month: '12',
      fields: [],
      bases: [],
    })
    expect(page.month).toBe('12')
  })

  it('isEmpty retorna true quando não há fields nem bases', () => {
    const page = PageHolerite.from({ page: 1, year: '2020', month: '01', fields: [], bases: [] })
    expect(page.isEmpty()).toBe(true)
  })

  it('isEmpty retorna false quando há fields', () => {
    const page = PageHolerite.from({
      page: 1,
      year: '2020',
      month: '01',
      fields: [PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value: '2.389,77' })],
      bases: [],
    })
    expect(page.isEmpty()).toBe(false)
  })

  it('isEmpty retorna false quando há bases', () => {
    const page = PageHolerite.from({
      page: 1,
      year: '2020',
      month: '01',
      fields: [],
      bases: [PayrollBase.from({ label: 'Base INSS', value: '2.545,68' })],
    })
    expect(page.isEmpty()).toBe(false)
  })

  it('preserva a ordem dos fields do documento', () => {
    const page = PageHolerite.from({
      page: 1,
      year: '2020',
      month: '01',
      fields: [
        PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value: '2.389,77' }),
        PayrollField.from({ code: '5560', label: 'Horas Extras - 50%', reference: '8,00', value: '155,91' }),
      ],
      bases: [],
    })
    expect(page.fields.map((f) => f.label)).toEqual(['Salário Base', 'Horas Extras - 50%'])
  })

  it('rejeita page menor que 1', () => {
    expect(() =>
      PageHolerite.from({ page: 0, year: '2020', month: '01', fields: [], bases: [] }),
    ).toThrow(/page/)
  })
})
