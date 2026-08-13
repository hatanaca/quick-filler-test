import { describe, expect, it, vi } from 'vitest'
import { ProcessTranscriptionUseCase } from '@quickfiller/application'
import {
  Transcription,
  TranscriptionId,
  DocumentType,
  TranscriptionStatus,
  type TranscriptionRepository,
  type FileStoragePort,
  type PdfExtractorPort,
  type OcrEnginePort,
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

interface FakeExtractorOptions {
  pagesText?: string[]
  renderError?: Error
}

function makeExtractor(opts: FakeExtractorOptions = {}): PdfExtractorPort {
  const pagesText = opts.pagesText ?? ['texto da página 1']
  return {
    extractPages: vi.fn(async () => pagesText),
    renderPage: vi.fn(async () => {
      if (opts.renderError) throw opts.renderError
      return Buffer.from('png-fake')
    }),
  }
}

function makeOcr(recognized: Record<string, string> = {}): OcrEnginePort {
  return {
    recognize: vi.fn(async (img: Buffer) => recognized[img.toString()] ?? 'texto ocr'),
  }
}

const PDF_TEXT = `DIA   ENTRADA  SAIDA
21/05/2019  08:00  18:00
22/05/2019  08:00  18:00`

describe('ProcessTranscriptionUseCase', () => {
  it('processa cartão de ponto com texto embutido', async () => {
    const repo = new FakeRepository()
    const storage = new FakeStorage()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    await repo.save(t)
    await storage.save(id.value, Buffer.from('%PDF'))

    const extractor = makeExtractor({ pagesText: [PDF_TEXT] })
    const useCase = new ProcessTranscriptionUseCase(repo, storage, extractor, makeOcr())

    await useCase.execute(id)

    const updated = await repo.findById(id)
    expect(updated?.status).toBe(TranscriptionStatus.CONCLUIDO)
    expect(updated?.value).not.toBeNull()
  })

  it('cai para OCR quando o texto embutido é vazio (PDF escaneado)', async () => {
    const repo = new FakeRepository()
    const storage = new FakeStorage()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    await repo.save(t)
    await storage.save(id.value, Buffer.from('%PDF'))

    const extractor = makeExtractor({ pagesText: ['', ''] })
    const ocr = makeOcr({ 'png-fake': PDF_TEXT })
    const useCase = new ProcessTranscriptionUseCase(repo, storage, extractor, ocr)

    await useCase.execute(id)

    expect(extractor.renderPage).toHaveBeenCalled()
    expect(ocr.recognize).toHaveBeenCalled()
    const updated = await repo.findById(id)
    expect(updated?.status).toBe(TranscriptionStatus.CONCLUIDO)
  })

  it('marca como ERRO com mensagem legível quando extração falha', async () => {
    const repo = new FakeRepository()
    const storage = new FakeStorage()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    const t = Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO })
    await repo.save(t)
    await storage.save(id.value, Buffer.from('%PDF'))

    // página escaneada (texto vazio) → tenta OCR → falha ao renderizar
    const extractor = makeExtractor({
      pagesText: [''],
      renderError: new Error('falha ao renderizar'),
    })
    const ocr = makeOcr()
    const useCase = new ProcessTranscriptionUseCase(repo, storage, extractor, ocr)

    await useCase.execute(id)

    const updated = await repo.findById(id)
    expect(updated?.status).toBe(TranscriptionStatus.ERRO)
    expect(updated?.erro).toContain('falha ao renderizar')
  })

  it('marca como ERRO quando arquivo não existe no storage', async () => {
    const repo = new FakeRepository()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    await repo.save(Transcription.create({ id, tipo: DocumentType.CARTAO_PONTO }))

    const useCase = new ProcessTranscriptionUseCase(
      repo,
      new FakeStorage(),
      makeExtractor(),
      makeOcr(),
    )

    await useCase.execute(id)

    const updated = await repo.findById(id)
    expect(updated?.status).toBe(TranscriptionStatus.ERRO)
  })

  it('lança erro quando transcrição não existe', async () => {
    const useCase = new ProcessTranscriptionUseCase(
      new FakeRepository(),
      new FakeStorage(),
      makeExtractor(),
      makeOcr(),
    )

    await expect(
      useCase.execute(TranscriptionId.from('11111111-1111-4111-8111-111111111111')),
    ).rejects.toThrow(/não encontrada/)
  })

  it('processa holerite com tipo HOLERITE', async () => {
    const repo = new FakeRepository()
    const storage = new FakeStorage()
    const id = TranscriptionId.from('00000000-0000-4000-8000-000000000001')
    const t = Transcription.create({ id, tipo: DocumentType.HOLERITE })
    await repo.save(t)
    await storage.save(id.value, Buffer.from('%PDF'))

    const holeriteText = `Competência: 01/2020
0010 Salário Base 2.389,77
Base INSS 2.545,68`
    const extractor = makeExtractor({ pagesText: [holeriteText] })
    const useCase = new ProcessTranscriptionUseCase(repo, storage, extractor, makeOcr())

    await useCase.execute(id)

    const updated = await repo.findById(id)
    expect(updated?.status).toBe(TranscriptionStatus.CONCLUIDO)
  })
})
