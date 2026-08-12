import { describe, expect, it } from 'vitest'
import { CartaoPontoExtractor, HoleriteExtractor, type TranscriptionResult } from '@quickfiller/domain'

interface CartaoPunch {
  kind: string
  time_raw: string
  time_hhmm: string
}

interface CartaoDay {
  date_raw: string
  punches: CartaoPunch[]
}

function cartaoDays(result: TranscriptionResult): CartaoDay[] {
  const page = result.pages[0]
  if (!page || !('days' in page)) throw new Error('esperava página de cartão de ponto')
  return page.days as unknown as CartaoDay[]
}

interface HoleriteField {
  code: string
  label: string
  reference: string
  value: string
}

interface HoleriteBase {
  label: string
  value: string
}

function holeritePage(result: TranscriptionResult): {
  page: number
  year: string
  month: string
  fields: HoleriteField[]
  bases: HoleriteBase[]
} {
  const page = result.pages[0]
  if (!page || !('fields' in page)) throw new Error('esperava página de holerite')
  return page as unknown as {
    page: number
    year: string
    month: string
    fields: HoleriteField[]
    bases: HoleriteBase[]
  }
}

describe('CartaoPontoExtractor', () => {
  it('extrai dias e batidas em pares IN/OUT na ordem do documento', () => {
    const text = [
      'CARTÃO DE PONTO',
      '21/05/2019 08:25 12:00 13:05 18:25',
      '22/05/2019 08:20 12:10 13:00 18:30',
    ].join('\n')

    const result = CartaoPontoExtractor.extract([text])
    const days = cartaoDays(result)

    expect(result.pages[0]?.page).toBe(1)
    expect(days).toHaveLength(2)
    expect(days[0]?.date_raw).toBe('21/05/2019')
    expect(days[0]?.punches.map((p) => p.kind)).toEqual(['IN', 'OUT', 'IN', 'OUT'])
    expect(days[0]?.punches[0]?.time_raw).toBe('08:25')
  })

  it('dia sem batidas continua como linha válida', () => {
    const text = '21/05/2019 08:00 18:00\n25/05/2019'
    const result = CartaoPontoExtractor.extract([text])
    const days = cartaoDays(result)
    expect(days[1]?.date_raw).toBe('25/05/2019')
    expect(days[1]?.punches).toHaveLength(0)
  })

  it('preserva "?" de incerteza no horário', () => {
    const text = '21/05/2019 0?:25 18:00'
    const result = CartaoPontoExtractor.extract([text])
    const punch = cartaoDays(result)[0]?.punches[0]
    expect(punch?.time_raw).toBe('0?:25')
    expect(punch?.time_hhmm).toBe('0?:25')
  })

  it('normaliza horário sem zero à esquerda (8:25 → 08:25)', () => {
    const text = '21/05/2019 8:25 18:00'
    const result = CartaoPontoExtractor.extract([text])
    expect(cartaoDays(result)[0]?.punches[0]?.time_hhmm).toBe('08:25')
  })

  it('não inventa dia sem data (linhas de cabeçalho ignoradas)', () => {
    const text = 'CARTÃO DE PONTO\nDIA ENTRADA SAIDA\n21/05/2019 08:00 18:00'
    const result = CartaoPontoExtractor.extract([text])
    expect(cartaoDays(result)).toHaveLength(1)
  })

  it('gera uma página por texto de página', () => {
    const result = CartaoPontoExtractor.extract(['21/05/2019 08:00 18:00', '22/05/2019 08:00 18:00'])
    expect(result.pages).toHaveLength(2)
    expect(result.pages[1]?.page).toBe(2)
  })
})

describe('HoleriteExtractor', () => {
  const text = [
    'HOLERITE',
    'Competência: 05/2019',
    '0010 Salário Base 220,00 2.389,77',
    '5560 Horas Extras - 50% 8,00 155,91',
    '0998 INSS - 262,87',
    'Base INSS 2.545,68',
    'Total Vencimentos 2.545,68',
    'Valor Líquido 2.237,71',
  ].join('\n')

  it('extrai competência, fields e bases', () => {
    const page = holeritePage(HoleriteExtractor.extract([text]))
    expect(page.year).toBe('2019')
    expect(page.month).toBe('05')
    expect(page.fields).toHaveLength(3)
    expect(page.bases).toHaveLength(3)
  })

  it('value = último valor monetário; reference = penúltimo', () => {
    const base = holeritePage(HoleriteExtractor.extract([text])).fields[0]
    expect(base?.code).toBe('0010')
    expect(base?.label).toBe('Salário Base')
    expect(base?.reference).toBe('220,00')
    expect(base?.value).toBe('2.389,77')
  })

  it('reference vazia quando documento não mostra QTDE/REF', () => {
    const inss = holeritePage(HoleriteExtractor.extract([text])).fields.find(
      (f) => f.code === '0998',
    )
    expect(inss?.label).toBe('INSS')
    expect(inss?.reference).toBe('')
    expect(inss?.value).toBe('262,87')
  })

  it('label nunca contém o código da verba', () => {
    for (const field of holeritePage(HoleriteExtractor.extract([text])).fields) {
      expect(field.label.startsWith(field.code)).toBe(false)
    }
  })

  it('bases NÃO entram em fields (separação é a decisão central)', () => {
    const labels = holeritePage(HoleriteExtractor.extract([text])).fields.map((f) => f.label)
    expect(labels).not.toContain('Base INSS')
    expect(labels).not.toContain('Total Vencimentos')
    expect(labels).not.toContain('Valor Líquido')
  })

  it('página sem competência legível usa "?" (honestidade)', () => {
    const page = holeritePage(HoleriteExtractor.extract(['0010 Salário Base 220,00 2.389,77']))
    expect(page.year).toBe('????')
    expect(page.month).toBe('0?')
  })

  it('competência com "?" de incerteza é preservada', () => {
    const page = holeritePage(HoleriteExtractor.extract(['Competência: 0?/2019']))
    expect(page.month).toBe('0?')
  })
})
