import { describe, expect, it } from 'vitest'
import {
  WarningCalculator,
  DayRecord,
  PageHolerite,
  PayrollField,
  PayrollBase,
  Punch,
} from '@quickfiller/domain'

const punch = (kind: 'IN' | 'OUT', time: string) =>
  Punch.from({ kind, time_raw: time, time_hhmm: time })

const day = (date_raw: string, punches: ReturnType<typeof punch>[] = []) =>
  DayRecord.from({ date_raw, punches })

const page = (page: number, month: string, year = '2020', withData = true) =>
  PageHolerite.from({
    page,
    year,
    month,
    fields: withData
      ? [
          PayrollField.from({
            code: '0010',
            label: 'Salário Base',
            reference: '',
            value: '2.389,77',
          }),
        ]
      : [],
    bases: withData ? [PayrollBase.from({ label: 'Base INSS', value: '2.545,68' })] : [],
  })

describe('WarningCalculator — cartão de ponto', () => {
  it('detecta batidas ímpares', () => {
    const days = [
      day('21/05/2019', [punch('IN', '08:00'), punch('OUT', '12:00'), punch('IN', '13:00')]),
    ]
    const warnings = WarningCalculator.cartaoPonto(days)
    expect(warnings.find((w) => w.index === 0)?.types).toContain('odd-punches')
  })

  it('não acusa batidas ímpares para dia com 4 batidas', () => {
    const days = [
      day('21/05/2019', [
        punch('IN', '08:00'),
        punch('OUT', '12:00'),
        punch('IN', '13:00'),
        punch('OUT', '18:00'),
      ]),
    ]
    expect(WarningCalculator.cartaoPonto(days)).toEqual([])
  })

  it('detecta data não sequencial', () => {
    const days = [day('20/05/2019'), day('25/05/2019')]
    const warnings = WarningCalculator.cartaoPonto(days)
    expect(warnings.find((w) => w.index === 1)?.types).toContain('non-sequential-date')
  })

  it('não acusa sequência válida', () => {
    const days = [day('20/05/2019'), day('21/05/2019'), day('22/05/2019')]
    expect(WarningCalculator.cartaoPonto(days)).toEqual([])
  })

  it('data ilegível não é marcada e não quebra a cadeia (próxima legível compara com a anterior)', () => {
    const days = [day('20/05/2019'), day('2?/05/2019'), day('22/05/2019')]
    const warnings = WarningCalculator.cartaoPonto(days)
    // o dia ilegível em si não é marcado
    expect(warnings.find((w) => w.index === 1)).toBeUndefined()
    // 22/05 compara com 20/05 (anterior legível) → não sequencial
    expect(warnings.find((w) => w.index === 2)?.types).toContain('non-sequential-date')
  })

  it('primeiro dia nunca é não sequencial', () => {
    const days = [day('25/05/2019')]
    expect(WarningCalculator.cartaoPonto(days)).toEqual([])
  })

  it('data impossível não vira âncora (dias seguintes ainda comparam com a legível anterior)', () => {
    const days = [day('01/01/2023'), day('38/07/2023'), day('06/01/2023')]
    const warnings = WarningCalculator.cartaoPonto(days)
    // 38/07 é impossível → marcada como não sequencial (erro de leitura)
    expect(warnings.find((w) => w.index === 1)?.types).toContain('non-sequential-date')
    // 06/01 compara com 01/01 (âncora legível) → 5 dias de salto
    expect(warnings.find((w) => w.index === 2)?.types).toContain('non-sequential-date')
  })

  it('data impossível por dia-do-mês (31/02) não vira âncora', () => {
    const days = [day('01/01/2023'), day('31/02/2023'), day('03/01/2023')]
    const warnings = WarningCalculator.cartaoPonto(days)
    expect(warnings.find((w) => w.index === 2)?.types).toContain('non-sequential-date')
  })
})

describe('WarningCalculator — holerite', () => {
  it('detecta página vazia', () => {
    const pages = [page(1, '01', '2020', false)]
    const warnings = WarningCalculator.holerite(pages)
    expect(warnings.find((w) => w.page === 1)?.types).toContain('empty-page')
  })

  it('detecta mês não sequencial', () => {
    const pages = [page(1, '01'), page(2, '03')]
    const warnings = WarningCalculator.holerite(pages)
    expect(warnings.find((w) => w.page === 2)?.types).toContain('non-sequential-month')
  })

  it('não acusa sequência mensal válida', () => {
    const pages = [page(1, '01'), page(2, '02'), page(3, '03')]
    expect(WarningCalculator.holerite(pages)).toEqual([])
  })

  it('dezembro → janeiro é consecutivo', () => {
    const pages = [page(1, '12', '2020'), page(2, '01', '2021')]
    expect(WarningCalculator.holerite(pages)).toEqual([])
  })

  it('competência ilegível não é marcada e não quebra a cadeia (próxima legível compara com a anterior)', () => {
    const pages = [page(1, '01'), page(2, '0?'), page(3, '03')]
    const warnings = WarningCalculator.holerite(pages)
    // a página com competência ilegível em si não é marcada
    expect(warnings.find((w) => w.page === 2)).toBeUndefined()
    // 03 compara com 01 (anterior legível) → não sequencial
    expect(warnings.find((w) => w.page === 3)?.types).toContain('non-sequential-month')
  })

  it('página vazia com mês válido continua na cadeia de sequência', () => {
    const pages = [page(1, '01'), page(2, '02', '2020', false)]
    const warnings = WarningCalculator.holerite(pages)
    const page2 = warnings.find((w) => w.page === 2)
    expect(page2?.types).toEqual(['empty-page'])
    expect(page2?.types).not.toContain('non-sequential-month')
  })

  it('retorna todas as situações para página com múltiplos avisos', () => {
    const pages = [page(1, '01'), page(2, '04', '2020', false)]
    const warnings = WarningCalculator.holerite(pages)
    expect(warnings.find((w) => w.page === 2)?.types).toEqual(
      expect.arrayContaining(['empty-page', 'non-sequential-month']),
    )
  })
})
