import type { TranscriptionResult } from '../value-objects/transcription-result.vo.js'
import type { DocumentType } from '../value-objects/document-type.vo.js'
import { CartaoPontoExtractor } from './cartao-ponto.extractor.js'
import { HoleriteExtractor } from './holerite.extractor.js'

export interface DocumentExtractor {
  extract(pagesText: string[]): TranscriptionResult
}

export function extractorFor(tipo: DocumentType): DocumentExtractor {
  switch (tipo) {
    case 'cartao-ponto':
      return CartaoPontoExtractor
    case 'holerite':
      return HoleriteExtractor
  }
}
