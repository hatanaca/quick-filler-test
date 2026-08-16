import { describe, expect, it } from 'vitest'
import { Money } from '@quickfiller/domain'

describe('Money', () => {
  it('aceita valor monetário brasileiro válido', () => {
    const money = Money.from('2.389,77')
    expect(money.raw).toBe('2.389,77')
  })

  it('aceita valor com zero à esquerda', () => {
    const money = Money.from('0,50')
    expect(money.raw).toBe('0,50')
  })

  it('rejeita valor em formato float', () => {
    expect(() => Money.from('2389.77')).toThrow(/formato/)
  })

  it('rejeita valor sem separador decimal', () => {
    expect(() => Money.from('2389')).toThrow(/formato/)
  })

  it('hasUncertainty retorna false para valor limpo', () => {
    const money = Money.from('2.389,77')
    expect(money.hasUncertainty()).toBe(false)
  })

  it('hasUncertainty retorna true quando contém "?"', () => {
    const money = Money.from('2.3?9,77')
    expect(money.hasUncertainty()).toBe(true)
  })

  it('hasUncertainty retorna true quando tudo é "?"', () => {
    const money = Money.from('????')
    expect(money.hasUncertainty()).toBe(true)
  })

  it('hasUncertainty retorna true quando o "?" está no último dígito', () => {
    const money = Money.from('2.389,7?')
    expect(money.hasUncertainty()).toBe(true)
  })

  it('toString retorna o valor raw', () => {
    const money = Money.from('2.389,77')
    expect(money.toString()).toBe('2.389,77')
  })

  it('NUNCA converte para float', () => {
    const money = Money.from('2.389,77')
    expect(typeof money.toString()).toBe('string')
    expect(money.toString()).not.toBe('2389.77')
  })

  it('aceita valor com "?" no lugar de qualquer dígito', () => {
    const money = Money.from('?39,77')
    expect(money.hasUncertainty()).toBe(true)
  })

  it('aceita valor totalmente incerto com separador decimal ("??,??")', () => {
    const money = Money.from('??,??')
    expect(money.hasUncertainty()).toBe(true)
  })

  it('aceita valor totalmente incerto com separador de milhar ("?.???")', () => {
    const money = Money.from('?.???')
    expect(money.hasUncertainty()).toBe(true)
  })
})
