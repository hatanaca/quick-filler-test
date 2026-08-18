import type { PageCartaoPonto } from '../value-objects/page-cartao-ponto.vo.js'
import type { PageHolerite } from '../value-objects/page-holerite.vo.js'

export type CartaoPontoResult = { kind: 'cartao-ponto'; pages: PageCartaoPonto[] }

export type HoleriteResult = { kind: 'holerite'; pages: PageHolerite[] }

export type TranscriptionResult = CartaoPontoResult | HoleriteResult
