import { describe, expect, it } from 'vitest'
import { PayrollField } from '@quickfiller/domain'

describe('PayrollField', () => {
  it('cria verba com code, label, reference e value', () => {
    const field = PayrollField.from({
      code: '0010',
      label: 'Salário Base',
      reference: '220,00',
      value: '2.389,77',
    })
    expect(field.code).toBe('0010')
    expect(field.label).toBe('Salário Base')
    expect(field.reference).toBe('220,00')
    expect(field.value).toBe('2.389,77')
  })

  it('aceita code vazio quando documento não mostra código', () => {
    const field = PayrollField.from({
      code: '',
      label: 'Salário Base',
      reference: '',
      value: '2.389,77',
    })
    expect(field.code).toBe('')
  })

  it('aceita reference vazia quando não há coluna QTDE/REF', () => {
    const field = PayrollField.from({
      code: '0010',
      label: 'Salário Base',
      reference: '',
      value: '2.389,77',
    })
    expect(field.reference).toBe('')
  })

  it('rejeita label vazia', () => {
    expect(() =>
      PayrollField.from({ code: '0010', label: '', reference: '', value: '2.389,77' }),
    ).toThrow(/label/)
  })

  it('rejeita value em formato float', () => {
    expect(() =>
      PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value: '2389.77' }),
    ).toThrow(/value/)
  })

  it('aceita value com "?" de incerteza', () => {
    const field = PayrollField.from({
      code: '0010',
      label: 'Salário Base',
      reference: '',
      value: '2.3?9,77',
    })
    expect(field.value).toBe('2.3?9,77')
  })
})
