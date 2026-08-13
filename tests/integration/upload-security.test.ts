import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '@quickfiller/infrastructure'
import {
  CreateTranscriptionUseCase,
  ExportSpreadsheetUseCase,
  GetTranscriptionUseCase,
  InMemoryEventBus,
  ProcessTranscriptionUseCase,
  UpdateTranscriptionUseCase,
} from '@quickfiller/application'
import {
  type Transcription,
  type TranscriptionId,
  type TranscriptionRepository,
  type FileStoragePort,
  type PdfExtractorPort,
  type OcrEnginePort,
  type SpreadsheetGeneratorPort,
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

class NoopExtractor implements PdfExtractorPort {
  async extractPages(): Promise<string[]> {
    return []
  }

  async renderPage(): Promise<Buffer> {
    return Buffer.from('png')
  }
}

class NoopOcr implements OcrEnginePort {
  async recognize(): Promise<string> {
    return ''
  }
}

class NoopGenerator implements SpreadsheetGeneratorPort {
  async generate() {
    return { buffer: Buffer.from(''), mimeType: 'application/octet-stream', extension: 'xlsx' }
  }
}

function multipart(
  body: Buffer,
  boundary: string,
): { payload: Buffer; headers: Record<string, string> } {
  const filePart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
  )
  const tipoPart = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\ncartao-ponto\r\n`,
  )
  const footer = Buffer.from(`--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([filePart, body, tipoPart, footer]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

describe('Segurança de upload', () => {
  let app: FastifyInstance
  let storage: FakeStorage

  const smallConfig = {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    uploadMaxSizeBytes: 1024,
    uploadMaxConcurrentPerIp: 1,
    processingTimeoutMs: 5_000,
    retentionMinutes: 60,
    corsOrigin: '*',
    rateLimitMax: 10_000,
    rateLimitWindowMs: 60_000,
    tesseractLang: 'por',
    ocrWorkerPoolSize: 1,
  } as const

  beforeAll(async () => {
    storage = new FakeStorage()
    const repo = new FakeRepository()
    const bus = new InMemoryEventBus()
    app = buildApp({
      config: smallConfig,
      createTranscription: new CreateTranscriptionUseCase(repo, storage, bus),
      getTranscription: new GetTranscriptionUseCase(repo),
      updateTranscription: new UpdateTranscriptionUseCase(repo),
      processTranscription: new ProcessTranscriptionUseCase(
        repo,
        storage,
        new NoopExtractor(),
        new NoopOcr(),
      ),
      exportSpreadsheet: new ExportSpreadsheetUseCase(repo, new NoopGenerator()),
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('aceita PDF dentro do limite', async () => {
    const { payload, headers } = multipart(Buffer.from('%PDF-1.4 pequeno'), 'b1')
    const res = await app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers })
    expect(res.statusCode).toBe(202)
  })

  it('rejeita PDF acima do limite com 4xx e mensagem', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.alloc(2048, 0x41)])
    const { payload, headers } = multipart(big, 'b2')
    const res = await app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })

  it('rejeita arquivo vazio', async () => {
    const { payload, headers } = multipart(Buffer.alloc(0), 'b3')
    const res = await app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers })
    expect(res.statusCode).toBe(400)
  })

  it('arquivo com magic bytes %PDF mas conteúdo lixo passa na validação de tipo', async () => {
    const { payload, headers } = multipart(Buffer.from('%PDF-1.7 lixo'), 'b4')
    const res = await app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers })
    expect(res.statusCode).toBe(202)
  })

  it('armazena com nome sanitizado (id, não nome original)', async () => {
    const { payload, headers } = multipart(Buffer.from('%PDF-1.4 sanitize'), 'b5')
    const res = await app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers })
    const { id } = res.json()
    expect(storage.files.has(id)).toBe(true)
    // nenhuma chave deve conter o nome original do arquivo (PII)
    for (const key of storage.files.keys()) {
      expect(key).not.toContain('doc.pdf')
      expect(key).toMatch(/^[0-9a-f-]{36}$/)
    }
  })

  it('rejeita uploads simultâneos acima do limite por IP (429)', async () => {
    const { payload, headers } = multipart(Buffer.from('%PDF-1.4 concorrencia'), 'b6')
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers }),
      app.inject({ method: 'POST', url: '/api/transcricoes', payload, headers }),
    ])
    const codes = [a.statusCode, b.statusCode].sort()
    expect(codes[0]).toBe(202)
    expect(codes[1]).toBe(429)
  })
})
