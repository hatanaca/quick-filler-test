import type { PageCartaoPonto } from '../value-objects/page-cartao-ponto.vo.js'
import type { PageHolerite } from '../value-objects/page-holerite.vo.js'

export type CartaoPontoResult = { pages: PageCartaoPonto[] }

export type HoleriteResult = { pages: PageHolerite[] }

export type TranscriptionResult = CartaoPontoResult | HoleriteResult
