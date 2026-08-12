import { describe, expect, it } from 'vitest'
import { Punch } from '@quickfiller/domain'

describe('Punch', () => {
  it('cria batida IN com time_raw e time_hhmm', () => {
    const punch = Punch.from({ kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' })
    expect(punch.kind).toBe('IN')
    expect(punch.time_raw).toBe('08:25')
    expect(punch.time_hhmm).toBe('08:25')
  })

  it('cria batida OUT com time_raw e time_hhmm', () => {
    const punch = Punch.from({ kind: 'OUT', time_raw: '18:25', time_hhmm: '18:25' })
    expect(punch.kind).toBe('OUT')
  })

  it('rejeita kind inválido', () => {
    expect(() =>
      Punch.from({ kind: 'MIDDLE', time_raw: '08:25', time_hhmm: '08:25' }),
    ).toThrow(/kind/)
  })

  it('preserva time_raw mesmo quando divergente do normalizado', () => {
    const punch = Punch.from({ kind: 'IN', time_raw: '8:25', time_hhmm: '08:25' })
    expect(punch.time_raw).toBe('8:25')
    expect(punch.time_hhmm).toBe('08:25')
  })

  it('aceita "?" no horário incerto, mantendo o mesmo valor em time_hhmm', () => {
    const punch = Punch.from({ kind: 'IN', time_raw: '0?:25', time_hhmm: '0?:25' })
    expect(punch.time_raw).toBe('0?:25')
    expect(punch.time_hhmm).toBe('0?:25')
  })

  it('rejeita time_hhmm fora do formato HH:MM 24h', () => {
    expect(() =>
      Punch.from({ kind: 'IN', time_raw: '25:00', time_hhmm: '25:00' }),
    ).toThrow(/hhmm/)
  })
})
