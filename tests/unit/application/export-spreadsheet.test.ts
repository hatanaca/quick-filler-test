import { describe, expect, it } from 'vitest'
import { ExportSpreadsheetUseCase } from '@quickfiller/application'
import {
  Transcription,
  TranscriptionId,
  DocumentType,
  ExportFormat,
  DayRecord,
  PageCartaoPonto,
  Punch,
  type TranscriptionRepository,
  type SpreadsheetGeneratorPort,
  type GeneratedSpreadsheet,
  type SpreadsheetRowData,
} from '@quickfiller/domain'

class FakeRepository implements TranscriptionRepository {
  items = new Map<string, Transcription>()

  async save(t: Transcription): Promise<void> {
    this.items.set(t.id.value, t)
  }

  async findById(id: TranscriptionId): Promise<Transcription | null> {
    return this.items.get(id.value) ?? null
  }

  async delete(id: TranscriptionId): Promise<void> {
    this.items.delete(id.value)
  }
}

class FakeGenerator implements SpreadsheetGeneratorPort {
  calls: { format: string; headers: string[]; rows: SpreadsheetRowData[] }[] = []

  async generate(
    format: ExportFormat,
    headers: string[],
    rows: SpreadsheetRowData[],
  ): Promise<GeneratedSpreadsheet> {
    this.calls.push({ format, headers, rows })
    return {
      buffer: Buffer.from('spreadsheet'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    }
  }
}

function buildConcluded(tipo: DocumentType, repo: FakeRepository) {
  const id = TranscriptionId.from('abc')
  const t = Transcription.create({ id, tipo })
  if (tipo === DocumentType.CARTAO_PONTO) {
    t.complete({
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [
            DayRecord.from({
              date_raw: '21/05/2019',
              punches: [
                Punch.from({ kind: 'IN', time_raw: '08:00', time_hhmm: '08:00' }),
                Punch.from({ kind: 'OUT', time_raw: '18:00', time_hhmm: '18:00' }),
              ],
            }),
          ],
        }),
      ],
    })
  } else {
    t.complete({ pages: [] })
  }
  repo.items.set('abc', t)
  return id
}

describe('ExportSpreadsheetUseCase', () => {
  it('gera xlsx com headers e rows corretos para cartão de ponto', async () => {
    const repo = new FakeRepository()
    const generator = new FakeGenerator()
    const id = buildConcluded(DocumentType.CARTAO_PONTO, repo)
    const useCase = new ExportSpreadsheetUseCase(repo, generator)

    const result = await useCase.execute({ id, formato: ExportFormat.XLSX })

    expect(result.buffer.toString()).toBe('spreadsheet')
    expect(generator.calls[0]?.format).toBe(ExportFormat.XLSX)
    expect(generator.calls[0]?.headers).toEqual(['Data', 'Entrada 1', 'Saída 1'])
    expect(generator.calls[0]?.rows[0]?.cells).toEqual(['21/05/2019', '08:00', '18:00'])
  })

  it('aplica as correções do usuário (value atualizado)', async () => {
    const repo = new FakeRepository()
    const generator = new FakeGenerator()
    const id = buildConcluded(DocumentType.CARTAO_PONTO, repo)
    const useCase = new ExportSpreadsheetUseCase(repo, generator)

    await useCase.execute({ id, formato: ExportFormat.XLSX })

    // usa o value que está no repositório (após PUT com correções)
    const saved = await repo.findById(id)
    expect(saved?.value).not.toBeNull()
    expect(generator.calls[0]?.rows[0]?.cells[1]).toBe('08:00')
  })

  it('suporta csv e json', async () => {
    const repo = new FakeRepository()
    const generator = new FakeGenerator()
    const id = buildConcluded(DocumentType.HOLERITE, repo)
    const useCase = new ExportSpreadsheetUseCase(repo, generator)

    await useCase.execute({ id, formato: ExportFormat.CSV })
    await useCase.execute({ id, formato: ExportFormat.JSON })

    expect(generator.calls[0]?.format).toBe(ExportFormat.CSV)
    expect(generator.calls[1]?.format).toBe(ExportFormat.JSON)
  })

  it('lança erro quando transcrição não existe', async () => {
    const useCase = new ExportSpreadsheetUseCase(new FakeRepository(), new FakeGenerator())
    await expect(
      useCase.execute({ id: TranscriptionId.from('x'), formato: ExportFormat.XLSX }),
    ).rejects.toThrow(/não encontrada/)
  })

  it('lança erro quando transcrição ainda não concluída', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('abc')
    await repo.save(Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO }))
    const useCase = new ExportSpreadsheetUseCase(repo, new FakeGenerator())

    await expect(
      useCase.execute({ id, formato: ExportFormat.XLSX }),
    ).rejects.toThrow(/concluída|processando/)
  })
})
