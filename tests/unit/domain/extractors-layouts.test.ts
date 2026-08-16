import { describe, expect, it } from 'vitest'
import {
  CartaoPontoExtractor,
  HoleriteExtractor,
  type CartaoPontoResult,
  type HoleriteResult,
  type PageCartaoPonto,
  type PageHolerite,
} from '@quickfiller/domain'

/**
 * Testes dos layouts REAIS dos documentos de exemplo (colunas separadas por
 * tab, como o PdfJsExtractorAdapter entrega). Fixtures copiadas da saída real.
 */

function cartaoPages(text: string): PageCartaoPonto[] {
  return (CartaoPontoExtractor.extract([text]) as unknown as CartaoPontoResult).pages
}

function holeritePages(text: string): PageHolerite[] {
  return (HoleriteExtractor.extract([text]) as unknown as HoleriteResult).pages
}

const SIPON = [
  'F O L H A   DE   F R E Q U E N C I A - SISTEMA DE PONTO ELETRONICO',
  'Mes/Ano\t:\t7 / 2012\tTipo de Jornada: FLEXIVEL',
  'Dia Semana\tJornada\tEntrada\tSaida\tOcorrencia\tQtde',
  '1 - DOM\t08:00',
  '2 - SEG\t08:00\t09:03\t14:05\tHE-BCO DE HORAS\t00:13',
  '15:12\t18:36\tHE-REMUNERADA\t00:13',
  '3 - TER\t08:00\t09:19\t14:02\tHE-BCO DE HORAS\t00:10',
  '15:10\t18:48\tHE-REMUNERADA\t00:11',
].join('\n')

describe('CartaoPontoExtractor — layout SIPON (FOLHA DE FREQUÊNCIA)', () => {
  it('reconstrói dd/mm/yyyy e ignora jornada + qtde de ocorrência', () => {
    const days = cartaoPages(SIPON)[0]?.days ?? []
    expect(days).toHaveLength(3)

    expect(days[0]?.date_raw).toBe('01/07/2012')
    expect(days[0]?.punches).toHaveLength(0)

    expect(days[1]?.date_raw).toBe('02/07/2012')
    expect(days[1]?.punches.map((p) => p.time_hhmm)).toEqual(['09:03', '14:05', '15:12', '18:36'])
    expect(days[1]?.punches.map((p) => p.kind)).toEqual(['IN', 'OUT', 'IN', 'OUT'])

    expect(days[2]?.date_raw).toBe('03/07/2012')
    expect(days[2]?.punches.map((p) => p.time_hhmm)).toEqual(['09:19', '14:02', '15:10', '18:48'])
  })

  it('dia com ocorrência sem qtde (DESTACAMENTO) não engole a batida seguinte', () => {
    const text = [
      'Mes/Ano\t:\t8 / 2012',
      'Dia Semana\tJornada\tEntrada\tSaida\tOcorrencia\tQtde',
      '21 - TER\t08:00\t09:12\t13:50\tDESTACAMENTO',
      '14:52\t18:20',
    ].join('\n')
    const days = cartaoPages(text)[0]?.days ?? []
    expect(days[0]?.punches.map((p) => p.time_hhmm)).toEqual(['09:12', '13:50', '14:52', '18:20'])
  })

  it('ocorrência com qtde (REG. SUSPENSO) não vira batida', () => {
    const text = [
      'Mes/Ano\t:\t8 / 2012',
      '15 - QUA\t08:00\t09:23\t12:42\tREG. SUSPENSO\t04:41',
    ].join('\n')
    const days = cartaoPages(text)[0]?.days ?? []
    expect(days[0]?.punches.map((p) => p.time_hhmm)).toEqual(['09:23', '12:42'])
  })

  it('dia com marcador repetido (batidas em mais de 2 linhas) continua o mesmo dia', () => {
    const text = [
      'Mes/Ano\t:\t7 / 2012',
      '17 - TER\t08:00\t09:09\t13:01\tHE-BCO DE HORAS\t00:13',
      '17 - TER\t08:00\t14:16\t18:50\tHE-REMUNERADA\t00:13',
    ].join('\n')
    const days = cartaoPages(text)[0]?.days ?? []
    expect(days).toHaveLength(1)
    expect(days[0]?.punches.map((p) => p.time_hhmm)).toEqual(['09:09', '13:01', '14:16', '18:50'])
  })
})

describe('CartaoPontoExtractor — layout Banco do Brasil (PONTO ELETRÔNICO)', () => {
  const BB = [
    'Banco do Brasil PONTO ELETRÔNICO',
    'Mês/Ano: 05/2010',
    '01 SAB Feriado',
    '17 SEG 12:00-18:15 15:00-15:15',
    '18 TER 09:00-1800 12:00-13:00',
  ].join('\n')

  it('reconstrói a data e extrai só o primeiro intervalo (EntradaSaida)', () => {
    const days = cartaoPages(BB)[0]?.days ?? []
    expect(days).toHaveLength(3)

    expect(days[0]?.date_raw).toBe('01/05/2010')
    expect(days[0]?.punches).toHaveLength(0)

    expect(days[1]?.date_raw).toBe('17/05/2010')
    expect(days[1]?.punches.map((p) => p.time_hhmm)).toEqual(['12:00', '18:15'])

    expect(days[2]?.date_raw).toBe('18/05/2010')
    // "1800" (OCR sem ":") é normalizado para "18:00"
    expect(days[2]?.punches.map((p) => p.time_hhmm)).toEqual(['09:00', '18:00'])
  })
})

const DEMONSTRATIVO = [
  'D E M O N S T R A T I V O   D E   P A G A M E N T O   M E N S A L',
  'Período : 10/2019',
  'Cod. Descrição\tUnidade\tProventos\tDescontos',
  '0105 Dias Trabalhados\t30,00\t1.678,61',
  '2100 DSR sobre Variaveis\t26,77',
  '/314 Contr. INSS Remuneração\t9,00\t177,03',
  '/B02 Adiantamento pago\t671,44',
  'Total\t1.967,07\t859,46',
  'Líqüido\t1.107,61',
  'Base I.N.S.S. :\t1.967,07\tF.G.T.S. do Mês\t:\t157,37',
  'Base I.R.R.F. :\t1.790,04\tBase I.R.R.F. 13o.:',
].join('\n')

describe('HoleriteExtractor — layout DEMONSTRATIVO DE PAGAMENTO', () => {
  const page = () => holeritePages(DEMONSTRATIVO)[0]

  it('extrai competência do Período', () => {
    expect(page()?.year).toBe('2019')
    expect(page()?.month).toBe('10')
  })

  it('value = último monetário (Proventos ou Descontos); reference = Unidade', () => {
    const fields = page()?.fields ?? []
    expect(fields.find((f) => f.code === '0105')).toMatchObject({
      label: 'Dias Trabalhados',
      reference: '30,00',
      value: '1.678,61',
    })
    expect(fields.find((f) => f.code === '/314')).toMatchObject({
      label: 'Contr. INSS Remuneração',
      reference: '9,00',
      value: '177,03',
    })
    expect(fields.find((f) => f.code === '/B02')).toMatchObject({
      label: 'Adiantamento pago',
      reference: '',
      value: '671,44',
    })
    expect(fields.find((f) => f.code === '2100')).toMatchObject({
      label: 'DSR sobre Variaveis',
      reference: '',
      value: '26,77',
    })
  })

  it('extrai bases da seção inferior (Total com 2 valores, Líqüido, INSS, FGTS, IR)', () => {
    const bases = page()?.bases ?? []
    expect(bases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Total Vencimentos', value: '1.967,07' }),
        expect.objectContaining({ label: 'Total Descontos', value: '859,46' }),
        expect.objectContaining({ label: 'Valor Líquido', value: '1.107,61' }),
        expect.objectContaining({ label: 'Base INSS', value: '1.967,07' }),
        expect.objectContaining({ label: 'FGTS', value: '157,37' }),
        expect.objectContaining({ label: 'Base IR', value: '1.790,04' }),
      ]),
    )
  })
})

const DECLARACAO = [
  'Declaração Remuneração - Folha de Pagamento',
  'Mês/Ano:\t08/2018\tFolha de Pagamento:\tMÊS',
  'Verba\tNome\tBase / Saldo / Benefício\tValor',
  '010\tVENCIMENTO PADRAO-VP\t3.059,94',
  '803\tPREVI PESSOAL PB2\t6.188,63\t-433,20',
  'Remuneração Função Vl. Ref.:\t5.017,04 Proventos Retidos:\t0,00 Proventos Bruto:\t6.188,63',
  'Provisão FGTS:\t495,09 Margem (70%):\t2.494,96 Proventos Líquidos:\t4.351,55',
  'Mês/Ano:\t08/2018\tFolha de Pagamento:\tACERTO',
  '058\tHORA EXTRA-BCO HORAS-CONV\tJULHO/18\t-12,89',
  '765\tCASSI-PARTICIPACOES\t-67,72',
].join('\n')

describe('HoleriteExtractor — layout DECLARAÇÃO REMUNERAÇÃO', () => {
  it('gera uma entrada por seção (MÊS e ACERTO) compartilhando o page', () => {
    const pages = holeritePages(DECLARACAO)
    expect(pages).toHaveLength(2)
    expect(pages[0]?.page).toBe(1)
    expect(pages[1]?.page).toBe(1)
    expect(pages[0]?.month).toBe('08')
    expect(pages[0]?.year).toBe('2018')
    expect(pages[1]?.month).toBe('08')
  })

  it('value negativo vira absoluto; reference pode ser valor ou texto', () => {
    const pages = holeritePages(DECLARACAO)
    const fields = pages[0]?.fields ?? []
    expect(fields.find((f) => f.code === '010')).toMatchObject({
      label: 'VENCIMENTO PADRAO-VP',
      reference: '',
      value: '3.059,94',
    })
    expect(fields.find((f) => f.code === '803')).toMatchObject({
      label: 'PREVI PESSOAL PB2',
      reference: '6.188,63',
      value: '433,20',
    })
    const horaExtra = pages[1]?.fields.find((f) => f.code === '058')
    expect(horaExtra).toMatchObject({
      label: 'HORA EXTRA-BCO HORAS-CONV',
      reference: 'JULHO/18',
      value: '12,89',
    })
  })

  it('extrai bases do rodapé (vários por linha)', () => {
    const bases = holeritePages(DECLARACAO)[0]?.bases ?? []
    expect(bases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Proventos Bruto', value: '6.188,63' }),
        expect.objectContaining({ label: 'Provisão FGTS', value: '495,09' }),
        expect.objectContaining({ label: 'Proventos Líquidos', value: '4.351,55' }),
      ]),
    )
  })
})

const FICHA = [
  'FICHAFINANCEIRA-PERIODO:2017/04 a 2025/03',
  'Folha Normal',
  'Mês:\tabr-17',
  'REMUNERAÇÃOMES\t969,73\t290 VA Funcionario\t0\t30,67\tBASEDECALCULODOINSS\t1.260,65',
  '91 Hr Adic Pericul\t146,67\t290,92\t511 INSS Normal\t0\t100,85\tVALORDOFGTS\t100,85',
  'TOT.RENDIMENTOS\t1.620,65\t561 IRF Normal\t0\t0,00\tSALARIOLIQUIDONOMES\t1.392,55',
  'Folha Normal',
  'Mês:\tmai-17',
  'REMUNERAÇÃOMES\t1.454,59\t290 VA Funcionario\t0\t46,00\tBASEDECALCULODOINSS\t2.064,79',
].join('\n')

describe('HoleriteExtractor — layout FICHA FINANCEIRA', () => {
  it('gera uma entrada por mês compartilhando o page', () => {
    const pages = holeritePages(FICHA)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toMatchObject({ page: 1, month: '04', year: '2017' })
    expect(pages[1]).toMatchObject({ page: 1, month: '05', year: '2017' })
  })

  it('verbas sem código viram code="" e totais (TOT.RENDIMENTOS) são ignorados', () => {
    const fields = holeritePages(FICHA)[0]?.fields ?? []
    expect(fields.find((f) => f.label === 'REMUNERAÇÃOMES')).toMatchObject({
      code: '',
      reference: '',
      value: '969,73',
    })
    expect(fields.find((f) => f.label === 'TOT.RENDIMENTOS')).toBeUndefined()
    expect(fields.find((f) => f.label === 'Hr Adic Pericul')).toMatchObject({
      code: '91',
      reference: '146,67',
      value: '290,92',
    })
    expect(fields.find((f) => f.label === 'INSS Normal')).toMatchObject({
      code: '511',
      reference: '0',
      value: '100,85',
    })
  })

  it('coluna RESULTADOS vira bases (rótulos concatenados normalizados)', () => {
    const bases = holeritePages(FICHA)[0]?.bases ?? []
    expect(bases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Base INSS', value: '1.260,65' }),
        expect.objectContaining({ label: 'FGTS', value: '100,85' }),
        expect.objectContaining({ label: 'Valor Líquido', value: '1.392,55' }),
      ]),
    )
  })
})

describe('HoleriteExtractor — layout RECIBO DE PAGAMENTO (escaneado/OCR)', () => {
  const RECIBO = [
    'Recibo de Pagamento',
    'referência: 09/2010 MENSAL',
    'SALARIO 953,36 INSS MES 200,43',
    'SR COMISSAO 172,66 DESC ASS MEDICA AMIL 5,00',
    'TOTAL DE PROVENTOS 2.227,04 TOTAL DE DESCONTOS 211,43',
    'LIQUIDO A RECEBER 2.015,61',
  ].join('\n')

  it('verbas sem código viram fields e totais viram bases', () => {
    const page = holeritePages(RECIBO)[0]
    expect(page?.month).toBe('09')
    expect(page?.year).toBe('2010')

    const fields = page?.fields ?? []
    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '', label: 'SALARIO', value: '953,36' }),
        expect.objectContaining({ code: '', label: 'INSS MES', value: '200,43' }),
        expect.objectContaining({ code: '', label: 'SR COMISSAO', value: '172,66' }),
      ]),
    )

    const bases = page?.bases ?? []
    expect(bases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Total Vencimentos', value: '2.227,04' }),
        expect.objectContaining({ label: 'Total Descontos', value: '211,43' }),
        expect.objectContaining({ label: 'Valor Líquido', value: '2.015,61' }),
      ]),
    )
  })
})
