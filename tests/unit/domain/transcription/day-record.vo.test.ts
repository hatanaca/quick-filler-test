import { describe, expect, it } from 'vitest'
import { DayRecord, Punch } from '@quickfiller/domain'

describe('DayRecord', () => {
  it('cria registro com date_raw e punches', () => {
    const day = DayRecord.from({
      date_raw: '21/05/2019',
      punches: [Punch.from({ kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' })],
    })
    expect(day.date_raw).toBe('21/05/2019')
    expect(day.punches).toHaveLength(1)
  })

  it('punches vazios são válidos (dia sem batida)', () => {
    const day = DayRecord.from({ date_raw: '25/05/2019', punches: [] })
    expect(day.punches).toHaveLength(0)
  })

  it('preserva a ordem do documento', () => {
    const day = DayRecord.from({
      date_raw: '21/05/2019',
      punches: [
        Punch.from({ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }),
        Punch.from({ kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' }),
        Punch.from({ kind: 'IN', time_raw: '13:00', time_hhmm: '13:00' }),
        Punch.from({ kind: 'OUT', time_raw: '18:00', time_hhmm: '18:00' }),
      ],
    })
    expect(day.punches.map((p) => p.kind)).toEqual(['IN', 'OUT', 'IN', 'OUT'])
  })

  it('isOddPunches retorna true com 3 batidas', () => {
    const day = DayRecord.from({
      date_raw: '21/05/2019',
      punches: [
        Punch.from({ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }),
        Punch.from({ kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' }),
        Punch.from({ kind: 'IN', time_raw: '13:00', time_hhmm: '13:00' }),
      ],
    })
    expect(day.isOddPunches()).toBe(true)
  })

  it('isOddPunches retorna false com 4 batidas', () => {
    const day = DayRecord.from({
      date_raw: '21/05/2019',
      punches: [
        Punch.from({ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }),
        Punch.from({ kind: 'OUT', time_raw: '12:00', time_hhmm: '12:00' }),
        Punch.from({ kind: 'IN', time_raw: '13:00', time_hhmm: '13:00' }),
        Punch.from({ kind: 'OUT', time_raw: '18:00', time_hhmm: '18:00' }),
      ],
    })
    expect(day.isOddPunches()).toBe(false)
  })

  it('isOddPunches retorna false com 0 batidas', () => {
    const day = DayRecord.from({ date_raw: '25/05/2019', punches: [] })
    expect(day.isOddPunches()).toBe(false)
  })

  it('isOddPunches retorna false com 2 batidas (par)', () => {
    const day = DayRecord.from({
      date_raw: '21/05/2019',
      punches: [
        Punch.from({ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }),
        Punch.from({ kind: 'OUT', time_raw: '18:00', time_hhmm: '18:00' }),
      ],
    })
    expect(day.isOddPunches()).toBe(false)
  })

  it('isDateNonSequential retorna false quando é o primeiro dia', () => {
    const day = DayRecord.from({ date_raw: '21/05/2019', punches: [] })
    expect(day.isDateNonSequential(null)).toBe(false)
  })

  it('isDateNonSequential retorna false para dia consecutivo', () => {
    const prev = DayRecord.from({ date_raw: '20/05/2019', punches: [] })
    const day = DayRecord.from({ date_raw: '21/05/2019', punches: [] })
    expect(day.isDateNonSequential(prev)).toBe(false)
  })

  it('isDateNonSequential retorna true para dia que quebra sequência', () => {
    const prev = DayRecord.from({ date_raw: '20/05/2019', punches: [] })
    const day = DayRecord.from({ date_raw: '25/05/2019', punches: [] })
    expect(day.isDateNonSequential(prev)).toBe(true)
  })

  it('isDateNonSequential retorna true quando a data é impossível', () => {
    const prev = DayRecord.from({ date_raw: '20/05/2019', punches: [] })
    const day = DayRecord.from({ date_raw: '38/05/2019', punches: [] })
    expect(day.isDateNonSequential(prev)).toBe(true)
  })

  it('isDateNonSequential retorna false quando a data tem "?" (não legível não quebra)', () => {
    const prev = DayRecord.from({ date_raw: '20/05/2019', punches: [] })
    const day = DayRecord.from({ date_raw: '2?/05/2019', punches: [] })
    expect(day.isDateNonSequential(prev)).toBe(false)
  })

  it('rejeita date_raw vazia', () => {
    expect(() => DayRecord.from({ date_raw: '', punches: [] })).toThrow(/date/)
  })
})
