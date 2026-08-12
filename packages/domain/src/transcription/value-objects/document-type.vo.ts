export const DocumentType = {
  CARTAO_PONTO: 'cartao-ponto',
  HOLERITE: 'holerite',
} as const

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType]

export function isDocumentType(value: string): value is DocumentType {
  return value === DocumentType.CARTAO_PONTO || value === DocumentType.HOLERITE
}
