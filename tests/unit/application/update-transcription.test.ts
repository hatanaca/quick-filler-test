import { describe, expect, it } from 'vitest'
import { UpdateTranscriptionUseCase } from '@quickfiller/application'
import {
  Transcription,
  TranscriptionId,
  DocumentType,
  DayRecord,
  PageCartaoPonto,
  type TranscriptionRepository,
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

describe('UpdateTranscriptionUseCase', () => {
  it('atualiza value de transcrição concluída', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    t.complete({ kind: 'cartao-ponto', pages: [PageCartaoPonto.from({ page: 1, days: [] })] })
    await repo.save(t)
    const useCase = new UpdateTranscriptionUseCase(repo)

    const novoValue = {
      kind: 'cartao-ponto' as const,
      pages: [
        PageCartaoPonto.from({
          page: 1,
          days: [DayRecord.from({ date_raw: '21/05/2019', punches: [] })],
        }),
      ],
    }
    await useCase.execute({ id, value: novoValue })

    const updated = await repo.findById(id)
    expect(updated?.value).toEqual(novoValue)
  })

  it('lança erro quando transcrição não existe', async () => {
    const useCase = new UpdateTranscriptionUseCase(new FakeRepository())
    await expect(
      useCase.execute({
        id: TranscriptionId.from('11111111-1111-4111-8111-111111111111'),
        value: { kind: 'holerite', pages: [] },
      }),
    ).rejects.toThrow(/não encontrada/)
  })

  it('lança erro quando transcrição está em ERRO', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    t.fail('timeout')
    await repo.save(t)
    const useCase = new UpdateTranscriptionUseCase(repo)

    await expect(useCase.execute({ id, value: { kind: 'holerite', pages: [] } })).rejects.toThrow(
      /concluído|status/,
    )
  })

  it('lança erro quando transcrição ainda está processando', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    await repo.save(Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO }))
    const useCase = new UpdateTranscriptionUseCase(repo)

    await expect(useCase.execute({ id, value: { kind: 'holerite', pages: [] } })).rejects.toThrow(
      /concluído|status/,
    )
  })
})
