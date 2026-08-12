import { describe, expect, it } from 'vitest'
import { ExportFormat, isExportFormat } from '@quickfiller/domain'

describe('ExportFormat', () => {
  it('tem os três formatos literais do desafio', () => {
    expect(ExportFormat.XLSX).toBe('xlsx')
    expect(ExportFormat.CSV).toBe('csv')
    expect(ExportFormat.JSON).toBe('json')
  })

  it('isExportFormat aceita os três formatos', () => {
    expect(isExportFormat('xlsx')).toBe(true)
    expect(isExportFormat('csv')).toBe(true)
    expect(isExportFormat('json')).toBe(true)
  })

  it('isExportFormat rejeita formato desconhecido', () => {
    expect(isExportFormat('pdf')).toBe(false)
    expect(isExportFormat('XLSX')).toBe(false)
    expect(isExportFormat('')).toBe(false)
  })
})
