import { describe, expect, it } from 'vitest'
import { PayrollBase } from '@quickfiller/domain'

describe('PayrollBase', () => {
  it('cria base com label e value', () => {
    const base = PayrollBase.from({ label: 'Base INSS', value: '2.545,68' })
    expect(base.label).toBe('Base INSS')
    expect(base.value).toBe('2.545,68')
  })

  it('rejeita label vazia', () => {
    expect(() => PayrollBase.from({ label: '', value: '2.545,68' })).toThrow(/label/)
  })

  it('rejeita value em formato float', () => {
    expect(() => PayrollBase.from({ label: 'Base INSS', value: '2545.68' })).toThrow(/value/)
  })

  it('aceita value com "?" de incerteza', () => {
    const base = PayrollBase.from({ label: 'Base INSS', value: '2.5?5,68' })
    expect(base.value).toBe('2.5?5,68')
  })
})
