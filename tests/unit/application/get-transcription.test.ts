import { describe, expect, it } from 'vitest'
import { GetTranscriptionUseCase } from '@quickfiller/application'
import {
  Transcription,
  TranscriptionId,
  DocumentType,
  TranscriptionStatus,
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

describe('GetTranscriptionUseCase', () => {
  it('retorna transcrição existente com todos os campos', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('abc123')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    await repo.save(t)
    const useCase = new GetTranscriptionUseCase(repo)

    const result = await useCase.execute(id)
    expect(result.id).toBe('abc123')
    expect(result.tipo).toBe(DocumentType.CARTAO_PONTO)
    expect(result.status).toBe(TranscriptionStatus.PROCESSANDO)
    expect(result.erro).toBeNull()
    expect(result.value).toBeNull()
  })

  it('status PROCESSANDO → value null', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('abc')
    await repo.save(Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO }))
    const useCase = new GetTranscriptionUseCase(repo)

    const result = await useCase.execute(id)
    expect(result.value).toBeNull()
  })

  it('status CONCLUIDO → value presente', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('abc')
    const t = Transcription.create({ id, tipo: DocumentType.HOLERITE })
    t.complete({ pages: [] })
    await repo.save(t)
    const useCase = new GetTranscriptionUseCase(repo)

    const result = await useCase.execute(id)
    expect(result.value).toEqual({ pages: [] })
  })

  it('status ERRO → erro legível', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('abc')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    t.fail('PDF corrompido')
    await repo.save(t)
    const useCase = new GetTranscriptionUseCase(repo)

    const result = await useCase.execute(id)
    expect(result.status).toBe(TranscriptionStatus.ERRO)
    expect(result.erro).toBe('PDF corrompido')
  })

  it('lança erro quando transcrição não existe', async () => {
    const useCase = new GetTranscriptionUseCase(new FakeRepository())
    await expect(useCase.execute(TranscriptionId.from('nao-existe'))).rejects.toThrow(
      /não encontrada/,
    )
  })
})
