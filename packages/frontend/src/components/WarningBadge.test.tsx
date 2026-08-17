import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WarningBadge, rowStyle } from './WarningBadge'
import type { RowWarning } from '../utils/warnings'

describe('WarningBadge', () => {
  it('renders nothing when warning is null', () => {
    const { container } = render(<WarningBadge warning={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders warning badge with correct text', () => {
    const warning: RowWarning = {
      type: 'warning',
      reasons: ['Data fora de sequência'],
    }
    render(<WarningBadge warning={warning} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/Aviso/)).toBeInTheDocument()
    expect(screen.getByText(/Data fora de sequência/)).toBeInTheDocument()
  })

  it('renders error badge with correct text', () => {
    const warning: RowWarning = {
      type: 'error',
      reasons: ['CPF inválido'],
    }
    render(<WarningBadge warning={warning} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/Erro/)).toBeInTheDocument()
    expect(screen.getByText(/CPF inválido/)).toBeInTheDocument()
  })

  it('shows additional reasons count when multiple reasons', () => {
    const warning: RowWarning = {
      type: 'warning',
      reasons: ['Data fora de sequência', 'Valor suspeito'],
    }
    render(<WarningBadge warning={warning} />)

    expect(screen.getByText(/\+1/)).toBeInTheDocument()
  })

  it('has correct aria-label for error', () => {
    const warning: RowWarning = {
      type: 'error',
      reasons: ['CPF inválido', 'Formato errado'],
    }
    render(<WarningBadge warning={warning} />)

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Erro: CPF inválido; Formato errado',
    )
  })

  it('has correct aria-label for warning', () => {
    const warning: RowWarning = {
      type: 'warning',
      reasons: ['Data fora de sequência'],
    }
    render(<WarningBadge warning={warning} />)

    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Aviso: Data fora de sequência',
    )
  })
})

describe('rowStyle', () => {
  it('returns empty object when warning is null', () => {
    expect(rowStyle(null)).toEqual({})
  })

  it('returns error style for error type', () => {
    const warning: RowWarning = { type: 'error', reasons: ['test'] }
    const style = rowStyle(warning)

    expect(style.backgroundColor).toBe('#F8D7DA')
    expect(style.borderLeft).toBe('4px solid #DC3545')
  })

  it('returns warning style for warning type', () => {
    const warning: RowWarning = { type: 'warning', reasons: ['test'] }
    const style = rowStyle(warning)

    expect(style.backgroundColor).toBe('#FFF3CD')
    expect(style.borderLeft).toBeUndefined()
  })
})
