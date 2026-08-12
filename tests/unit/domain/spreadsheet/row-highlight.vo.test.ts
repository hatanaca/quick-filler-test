import { describe, expect, it } from 'vitest'
import { RowHighlight } from '@quickfiller/domain'

describe('RowHighlight', () => {
  it('warning usa fundo amarelo #FFF3CD e sem borda esquerda', () => {
    const h = RowHighlight.warning('Batidas ímpares')
    expect(h.type).toBe('warning')
    expect(h.backgroundColor).toBe('#FFF3CD')
    expect(h.leftBorderColor).toBeNull()
    expect(h.reason).toBe('Batidas ímpares')
  })

  it('error usa fundo vermelho #F8D7DA e borda esquerda #DC3545', () => {
    const h = RowHighlight.error('Data não sequencial')
    expect(h.type).toBe('error')
    expect(h.backgroundColor).toBe('#F8D7DA')
    expect(h.leftBorderColor).toBe('#DC3545')
    expect(h.reason).toBe('Data não sequencial')
  })

  it('rejeita reason vazia', () => {
    expect(() => RowHighlight.warning('')).toThrow(/reason/)
  })
})
