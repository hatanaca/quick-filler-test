import { describe, expect, it } from 'vitest'
import {
  CreateTranscriptionUseCase,
  InMemoryEventBus,
} from '@quickfiller/application'
import {
  type Transcription,
  type TranscriptionId,
  DocumentType,
  TranscriptionStatus,
  type TranscriptionRepository,
  type FileStoragePort,
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

class FakeStorage implements FileStoragePort {
  files = new Map<string, Buffer>()

  async save(id: string, buffer: Buffer): Promise<void> {
    this.files.set(id, buffer)
  }

  async read(id: string): Promise<Buffer> {
    const file = this.files.get(id)
    if (!file) throw new Error('arquivo não encontrado')
    return file
  }

  async delete(id: string): Promise<void> {
    this.files.delete(id)
  }
}

describe('CreateTranscriptionUseCase', () => {
  it('cria transcrição e retorna o id', async () => {
    const repo = new FakeRepository()
    const storage = new FakeStorage()
    const bus = new InMemoryEventBus()
    const useCase = new CreateTranscriptionUseCase(repo, storage, bus)

    const id = await useCase.execute({
      tipo: DocumentType.CARTAO_PONTO,
      arquivo: Buffer.from('%PDF-1.4 fake'),
      nomeArquivo: 'cartao.pdf',
    })

    expect(id.value).toBeTruthy()
    const saved = await repo.findById(id)
    expect(saved?.status).toBe(TranscriptionStatus.PROCESSANDO)
    expect(storage.files.has(id.value)).toBe(true)
  })

  it('valida tipo — rejeita tipo desconhecido', async () => {
    const useCase = new CreateTranscriptionUseCase(
      new FakeRepository(),
      new FakeStorage(),
      new InMemoryEventBus(),
    )

    await expect(
      useCase.execute({
        tipo: 'invalido' as never,
        arquivo: Buffer.from('%PDF'),
        nomeArquivo: 'x.pdf',
      }),
    ).rejects.toThrow(/tipo/)
  })

  it('persiste via repository e salva arquivo no storage', async () => {
    const repo = new FakeRepository()
    const storage = new FakeStorage()
    const useCase = new CreateTranscriptionUseCase(repo, storage, new InMemoryEventBus())

    const id = await useCase.execute({
      tipo: DocumentType.HOLERITE,
      arquivo: Buffer.from('%PDF holerite'),
      nomeArquivo: 'holerite.pdf',
    })

    expect(repo.items.size).toBe(1)
    expect(storage.files.get(id.value)?.toString()).toBe('%PDF holerite')
  })

  it('publica evento TranscriptionCreated no event bus', async () => {
    const bus = new InMemoryEventBus()
    const published: string[] = []
    bus.subscribe((event) => published.push(event.type))

    const useCase = new CreateTranscriptionUseCase(
      new FakeRepository(),
      new FakeStorage(),
      bus,
    )
    await useCase.execute({
      tipo: DocumentType.CARTAO_PONTO,
      arquivo: Buffer.from('%PDF'),
      nomeArquivo: 'c.pdf',
    })

    expect(published).toContain('transcription.created')
  })

  it('rejeita arquivo vazio', async () => {
    const useCase = new CreateTranscriptionUseCase(
      new FakeRepository(),
      new FakeStorage(),
      new InMemoryEventBus(),
    )

    await expect(
      useCase.execute({
        tipo: DocumentType.CARTAO_PONTO,
        arquivo: Buffer.alloc(0),
        nomeArquivo: 'vazio.pdf',
      }),
    ).rejects.toThrow(/arquivo/)
  })
})

describe('CreateTranscriptionUseCase — idempotência do retorno', () => {
  it('retorna ids diferentes para chamadas diferentes', async () => {
    const useCase = new CreateTranscriptionUseCase(
      new FakeRepository(),
      new FakeStorage(),
      new InMemoryEventBus(),
    )
    const id1 = await useCase.execute({
      tipo: DocumentType.CARTAO_PONTO,
      arquivo: Buffer.from('%PDF a'),
      nomeArquivo: 'a.pdf',
    })
    const id2 = await useCase.execute({
      tipo: DocumentType.CARTAO_PONTO,
      arquivo: Buffer.from('%PDF b'),
      nomeArquivo: 'b.pdf',
    })
    expect(id1.value).not.toBe(id2.value)
  })
})
