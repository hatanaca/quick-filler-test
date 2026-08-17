import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DownloadButton } from './DownloadButton'

// Mock the auth module
vi.mock('../api/auth', () => ({
  authenticatedFetch: vi.fn(),
}))

import { authenticatedFetch } from '../api/auth'

const mockAuthenticatedFetch = vi.mocked(authenticatedFetch)

describe('DownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders three download buttons', () => {
    render(<DownloadButton id="test-123" />)

    expect(screen.getByText('Baixar Excel (.xlsx)')).toBeInTheDocument()
    expect(screen.getByText('Baixar CSV')).toBeInTheDocument()
    expect(screen.getByText('Baixar JSON')).toBeInTheDocument()
  })

  it('calls authenticatedFetch with correct URL for xlsx', async () => {
    const mockBlob = new Blob(['test'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    } as Response)

    // Mock URL.createObjectURL and document.createElement
    const mockUrl = 'blob:test-url'
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl)
    vi.spyOn(URL, 'revokeObjectURL')

    const mockClick = vi.fn()
    const mockRemove = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
      remove: mockRemove,
    } as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'appendChild')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar Excel (.xlsx)'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/transcricoes/test-123/planilha?formato=xlsx',
      )
    })
  })

  it('calls authenticatedFetch with correct URL for csv', async () => {
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    } as Response)

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'appendChild')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar CSV'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/transcricoes/test-123/planilha?formato=csv',
      )
    })
  })

  it('calls authenticatedFetch with correct URL for json', async () => {
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    } as Response)

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL')
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'appendChild')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar JSON'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/transcricoes/test-123/planilha?formato=json',
      )
    })
  })

  it('does not download when response is not ok', async () => {
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: false,
    } as Response)

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar Excel (.xlsx)'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalled()
    })

    // Should not create download link
    expect(document.createElement).not.toHaveBeenCalled()
  })
})
