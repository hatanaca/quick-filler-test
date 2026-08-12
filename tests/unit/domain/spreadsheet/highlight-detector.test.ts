import { describe, expect, it } from 'vitest'
import { HighlightDetector, DayRecord, PageHolerite, PayrollField, Punch } from '@quickfiller/domain'

const day = (date_raw: string, punches: Punch[] = []) =>
  DayRecord.from({ date_raw, punches })

const punch = (kind: 'IN' | 'OUT', time: string) =>
  Punch.from({ kind, time_raw: time, time_hhmm: time })

const page = (page: number, month: string, value: string) =>
  PageHolerite.from({
    page,
    year: '2020',
    month,
    fields: [PayrollField.from({ code: '0010', label: 'Salário Base', reference: '', value })],
    bases: [],
  })

describe('HighlightDetector — cartão de ponto', () => {
  it('sem problemas → null', () => {
    expect(HighlightDetector.cartaoPontoDay(day('21/05/2019'), false)).toBeNull()
  })

  it('batidas ímpares → amarelo #FFF3CD', () => {
    const d = day('21/05/2019', [punch('IN', '08:00'), punch('OUT', '12:00'), punch('IN', '13:00')])
    const h = HighlightDetector.cartaoPontoDay(d, false)
    expect(h?.type).toBe('warning')
    expect(h?.backgroundColor).toBe('#FFF3CD')
    expect(h?.leftBorderColor).toBeNull()
  })

  it('"?" na linha → amarelo com motivo legível', () => {
    const d = day('2?/05/2019')
    const h = HighlightDetector.cartaoPontoDay(d, false)
    expect(h?.type).toBe('warning')
    expect(h?.reason).toContain('Leitura incerta')
  })

  it('data não sequencial → vermelho #F8D7DA + borda #DC3545', () => {
    const h = HighlightDetector.cartaoPontoDay(day('25/05/2019'), true)
    expect(h?.type).toBe('error')
    expect(h?.backgroundColor).toBe('#F8D7DA')
    expect(h?.leftBorderColor).toBe('#DC3545')
  })

  it('ambos (ímpar + não sequencial) → vermelho ganha', () => {
    const d = day('25/05/2019', [punch('IN', '08:00')])
    const h = HighlightDetector.cartaoPontoDay(d, true)
    expect(h?.type).toBe('error')
  })

  it('motivo inclui todos os problemas encontrados', () => {
    const d = day('2?/05/2019', [punch('IN', '08:00')])
    const h = HighlightDetector.cartaoPontoDay(d, false)
    expect(h?.reason).toContain('Batidas ímpares')
    expect(h?.reason).toContain('Leitura incerta')
  })
})

describe('HighlightDetector — holerite', () => {
  it('página com dados e mês sequencial → null', () => {
    expect(HighlightDetector.holeritePage(page(1, '01', '2.389,77'), false)).toBeNull()
  })

  it('página vazia → amarelo', () => {
    const empty = PageHolerite.from({ page: 1, year: '2020', month: '01', fields: [], bases: [] })
    const h = HighlightDetector.holeritePage(empty, false)
    expect(h?.type).toBe('warning')
    expect(h?.reason).toContain('Página vazia')
  })

  it('"?" no valor → amarelo', () => {
    const h = HighlightDetector.holeritePage(page(1, '01', '2.3?9,77'), false)
    expect(h?.type).toBe('warning')
    expect(h?.reason).toContain('Leitura incerta')
  })

  it('mês não sequencial → vermelho', () => {
    const h = HighlightDetector.holeritePage(page(2, '03', '2.389,77'), true)
    expect(h?.type).toBe('error')
    expect(h?.leftBorderColor).toBe('#DC3545')
  })

  it('vazia + não sequencial → vermelho ganha', () => {
    const empty = PageHolerite.from({ page: 1, year: '2020', month: '04', fields: [], bases: [] })
    const h = HighlightDetector.holeritePage(empty, true)
    expect(h?.type).toBe('error')
    expect(h?.reason).toContain('Página vazia')
    expect(h?.reason).toContain('Mês não sequencial')
  })
})
