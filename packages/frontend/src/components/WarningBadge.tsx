import type { RowWarning } from '../utils/warnings'

const WARNING_BG = '#FFF3CD'
const ERROR_BG = '#F8D7DA'
const ERROR_BORDER = '#DC3545'

export function rowStyle(warning: RowWarning | null): React.CSSProperties {
  if (!warning) return {}
  if (warning.type === 'error') {
    return { backgroundColor: ERROR_BG, borderLeft: `4px solid ${ERROR_BORDER}` }
  }
  return { backgroundColor: WARNING_BG }
}

export function WarningBadge({ warning }: { warning: RowWarning | null }) {
  if (!warning) return null
  const isError = warning.type === 'error'
  return (
    <span
      role="status"
      aria-label={
        isError ? `Erro: ${warning.reasons.join('; ')}` : `Aviso: ${warning.reasons.join('; ')}`
      }
      className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: isError ? ERROR_BG : WARNING_BG,
        color: isError ? '#842029' : '#7a5c00',
      }}
      title={warning.reasons.join('; ')}
    >
      {isError ? '⚠ Erro' : '• Aviso'}: {warning.reasons[0]}
      {warning.reasons.length > 1 ? ` +${warning.reasons.length - 1}` : ''}
    </span>
  )
}
