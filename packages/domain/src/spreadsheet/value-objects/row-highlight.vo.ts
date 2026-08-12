import { DomainError } from '../../shared/errors/domain.error.js'

export const HIGHLIGHT_COLORS = {
  WARNING_BG: '#FFF3CD',
  ERROR_BG: '#F8D7DA',
  ERROR_LEFT_BORDER: '#DC3545',
} as const

export type HighlightType = 'warning' | 'error'

export class RowHighlight {
  readonly type: HighlightType
  readonly reason: string
  readonly backgroundColor: string
  readonly leftBorderColor: string | null

  private constructor(
    type: HighlightType,
    reason: string,
    backgroundColor: string,
    leftBorderColor: string | null,
  ) {
    this.type = type
    this.reason = reason
    this.backgroundColor = backgroundColor
    this.leftBorderColor = leftBorderColor
  }

  static warning(reason: string): RowHighlight {
    if (!reason.trim()) throw new DomainError('reason não pode ser vazio')
    return new RowHighlight('warning', reason, HIGHLIGHT_COLORS.WARNING_BG, null)
  }

  static error(reason: string): RowHighlight {
    if (!reason.trim()) throw new DomainError('reason não pode ser vazio')
    return new RowHighlight(
      'error',
      reason,
      HIGHLIGHT_COLORS.ERROR_BG,
      HIGHLIGHT_COLORS.ERROR_LEFT_BORDER,
    )
  }
}
