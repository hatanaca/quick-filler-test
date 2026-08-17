import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { DownloadButton } from './DownloadButton'

// Mock the auth module
vi.mock('../api/auth', () => ({
  authenticatedFetch: vi.fn(),
}))

import { authenticatedFetch } from '../api/auth'

const mockAuthenticatedFetch = vi.mocked(authenticatedFetch)

describe('DownloadButton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
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

    // Spy on URL methods (they exist in jsdom via the setup file)
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar Excel (.xlsx)'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/transcricoes/test-123/planilha?formato=xlsx',
      )
      expect(createSpy).toHaveBeenCalled()
      expect(appendSpy).toHaveBeenCalled()
      expect(revokeSpy).toHaveBeenCalled()
    })
  })

  it('calls authenticatedFetch with correct URL for csv', async () => {
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    } as Response)

    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(document.body, 'appendChild')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar CSV'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/transcricoes/test-123/planilha?formato=csv',
      )
      expect(createSpy).toHaveBeenCalled()
    })
  })

  it('calls authenticatedFetch with correct URL for json', async () => {
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
    } as Response)

    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(document.body, 'appendChild')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar JSON'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
        '/api/transcricoes/test-123/planilha?formato=json',
      )
      expect(createSpy).toHaveBeenCalled()
    })
  })

  it('does not download when response is not ok', async () => {
    mockAuthenticatedFetch.mockResolvedValueOnce({
      ok: false,
    } as Response)

    const createSpy = vi.spyOn(URL, 'createObjectURL')

    render(<DownloadButton id="test-123" />)

    fireEvent.click(screen.getByText('Baixar Excel (.xlsx)'))

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalled()
    })

    // Component returns early when !response.ok, so no blob URL is created
    expect(createSpy).not.toHaveBeenCalled()
  })
})
