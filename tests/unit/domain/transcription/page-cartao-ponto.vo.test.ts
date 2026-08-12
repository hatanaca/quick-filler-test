import { describe, expect, it } from 'vitest'
import { PageCartaoPonto, DayRecord } from '@quickfiller/domain'

describe('PageCartaoPonto', () => {
  it('cria página com page e days', () => {
    const page = PageCartaoPonto.from({
      page: 1,
      days: [DayRecord.from({ date_raw: '21/05/2019', punches: [] })],
    })
    expect(page.page).toBe(1)
    expect(page.days).toHaveLength(1)
  })

  it('preserva a ordem dos days do documento', () => {
    const page = PageCartaoPonto.from({
      page: 1,
      days: [
        DayRecord.from({ date_raw: '21/05/2019', punches: [] }),
        DayRecord.from({ date_raw: '25/05/2019', punches: [] }),
      ],
    })
    expect(page.days.map((d) => d.date_raw)).toEqual(['21/05/2019', '25/05/2019'])
  })

  it('rejeita page menor que 1', () => {
    expect(() => PageCartaoPonto.from({ page: 0, days: [] })).toThrow(/page/)
  })
})
