import { describe, expect, it } from 'vitest'
import { ExcelJsGeneratorAdapter } from '@quickfiller/infrastructure'

describe('ExcelJsGeneratorAdapter', () => {
  it('gera xlsx mesmo sem linhas de dados (sheet.columns é array)', async () => {
    const gen = new ExcelJsGeneratorAdapter()
    const empty = await gen.generate('xlsx', ['Data', 'Entrada 1'], [])
    expect(empty.buffer.length).toBeGreaterThan(0)
    expect(empty.mimeType).toContain('spreadsheetml')
  })

  it('gera xlsx com células vazias (null → "")', async () => {
    const gen = new ExcelJsGeneratorAdapter()
    const withEmpty = await gen.generate(
      'xlsx',
      ['Data', 'Entrada 1'],
      [{ cells: [null, null], highlight: null }],
    )
    expect(withEmpty.buffer.length).toBeGreaterThan(0)
  })

  it('CSV neutraliza fórmulas (= + - @) e preserva BOM UTF-8', async () => {
    const gen = new ExcelJsGeneratorAdapter()
    const csv = await gen.generate(
      'csv',
      ['A', 'B'],
      [{ cells: ['=1+1', '-cmd'], highlight: null }],
    )
    const text = csv.buffer.toString('utf8')
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text).toContain("'=1+1")
    expect(text).toContain("'-cmd")
  })

  it('CSV neutraliza fórmula com espaço inicial e tab/CR (OWASP)', async () => {
    const gen = new ExcelJsGeneratorAdapter()
    const csv = await gen.generate('csv', ['A'], [{ cells: [' =1+1', '\t@cmd'], highlight: null }])
    const text = csv.buffer.toString('utf8')
    expect(text).toContain("' =1+1")
    expect(text).toContain("'\t@cmd")
  })

  it('CSV escapa vírgulas e aspas', async () => {
    const gen = new ExcelJsGeneratorAdapter()
    const csv = await gen.generate('csv', ['A'], [{ cells: ['a,"b",c'], highlight: null }])
    expect(csv.buffer.toString('utf8')).toContain('"a,""b"",c"')
  })

  it('JSON exporta objetos com headers como chaves', async () => {
    const gen = new ExcelJsGeneratorAdapter()
    const json = await gen.generate(
      'json',
      ['Data', 'Valor'],
      [{ cells: ['21/05/2019', '2.389,77'], highlight: null }],
    )
    expect(JSON.parse(json.buffer.toString('utf8'))).toEqual([
      { Data: '21/05/2019', Valor: '2.389,77' },
    ])
  })
})
