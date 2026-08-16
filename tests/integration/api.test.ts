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

class FakePdfExtractor implements PdfExtractorPort {
  pagesText: string[] = []

  async extractPages(): Promise<string[]> {
    return this.pagesText
  }

  async renderPage(): Promise<Buffer> {
    return Buffer.from('png')
  }
}

class FakeOcr implements OcrEnginePort {
  text = ''

  async recognize(): Promise<string> {
    return this.text
  }
}

class FakeGenerator implements SpreadsheetGeneratorPort {
  async generate() {
    return {
      buffer: Buffer.from('planilha'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    }
  }
}

const config = {
  nodeEnv: 'test',
  port: 0,
  host: '127.0.0.1',
  uploadMaxSizeBytes: 10 * 1024 * 1024,
  uploadMaxConcurrentPerIp: 3,
  processingTimeoutMs: 60_000,
  retentionMinutes: 60,
  corsOrigin: '*',
  rateLimitMax: 10_000,
  rateLimitWindowMs: 60_000,
  tesseractLang: 'por',
  ocrWorkerPoolSize: 1,
  trustProxy: ['loopback' as const],
  pdfRenderScale: 4,
  ocrConfidenceThreshold: 40,
  ocrPreprocess: 'auto',
  ocrPsm: 6,
  ocrWhitelist: '',
} as const

const PDF_BYTES = Buffer.from('%PDF-1.4 fake content')

describe('API HTTP — contrato do desafio', () => {
  let app: FastifyInstance
  let repo: FakeRepository
  let storage: FakeStorage
  let pdfExtractor: FakePdfExtractor
  let ocr: FakeOcr
  let generator: FakeGenerator

  beforeAll(async () => {
    repo = new FakeRepository()
    storage = new FakeStorage()
    pdfExtractor = new FakePdfExtractor()
    ocr = new FakeOcr()
    generator = new FakeGenerator()
    const bus = new InMemoryEventBus()

    app = buildApp({
      config,
      createTranscription: new CreateTranscriptionUseCase(repo, storage, bus),
      getTranscription: new GetTranscriptionUseCase(repo),
      updateTranscription: new UpdateTranscriptionUseCase(repo),
      processTranscription: new ProcessTranscriptionUseCase(repo, storage, pdfExtractor, ocr),
      exportSpreadsheet: new ExportSpreadsheetUseCase(repo, generator),
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /healthz → 200 OK', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
  })

  it('POST /api/transcricoes → 202 com id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(PDF_BYTES, 'cartao-ponto'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
  })

  it('POST sem arquivo → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(undefined, 'cartao-ponto'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST com arquivo não-PDF (.txt renomeado) → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(Buffer.from('isto não é um pdf'), 'cartao-ponto'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().erro).toMatch(/PDF/)
  })

  it('POST com tipo inválido → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(PDF_BYTES, 'invalido'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/transcricoes/:id → 200 com status', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(PDF_BYTES, 'holerite'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    const { id } = post.json()

    const res = await app.inject({ method: 'GET', url: `/api/transcricoes/${id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(id)
    expect(['processando', 'concluido', 'erro']).toContain(body.status)
    expect(body.erro).toBeNull()
  })

  it('GET /api/transcricoes/:id inexistente → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transcricoes/11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /api/transcricoes/:id → atualiza value', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(PDF_BYTES, 'cartao-ponto'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    const { id } = post.json()
    // o processamento roda dentro do POST (slot da fila) — aguarda concluir
    await waitForDone(app, id)

    const novoValue = {
      pages: [
        {
          page: 1,
          days: [
            {
              date_raw: '21/05/2019',
              punches: [
                { kind: 'IN', time_raw: '08:25', time_hhmm: '08:25' },
                { kind: 'OUT', time_raw: '18:25', time_hhmm: '18:25' },
              ],
            },
          ],
        },
      ],
    }
    const res = await app.inject({
      method: 'PUT',
      url: `/api/transcricoes/${id}`,
      payload: { value: novoValue },
    })
    expect(res.statusCode).toBe(200)

    const get = await app.inject({ method: 'GET', url: `/api/transcricoes/${id}` })
    expect(get.json().value.pages[0].days[0].date_raw).toBe('21/05/2019')
  })

  it('PUT com value inválido (money float) → 400', async () => {
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(PDF_BYTES, 'holerite'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    const { id } = post.json()
    await waitForDone(app, id)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/transcricoes/${id}`,
      payload: {
        value: {
          pages: [
            {
              page: 1,
              year: '2020',
              month: '01',
              fields: [{ code: '0010', label: 'Salário Base', reference: '', value: '2389.77' }],
              bases: [],
            },
          ],
        },
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/transcricoes/:id/planilha?formato=xlsx → 200', async () => {
    // extrator fake com texto real de cartão para a planilha ter linhas
    pdfExtractor.pagesText = ['21/05/2019 08:25 12:00 13:00 18:25']
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      payload: createMultipart(PDF_BYTES, 'cartao-ponto'),
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
    })
    const { id } = post.json()
    await waitForDone(app, id)

    const res = await app.inject({
      method: 'GET',
      url: `/api/transcricoes/${id}/planilha?formato=xlsx`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('spreadsheetml')
  })

  it('GET /planilha com formato inválido → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transcricoes/x/planilha?formato=pdf',
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /planilha para transcrição inexistente → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transcricoes/11111111-1111-4111-8111-111111111111/planilha?formato=xlsx',
    })
    expect(res.statusCode).toBe(404)
  })
})

function createMultipart(file?: Buffer, tipo?: string): string {
  let body = ''
  if (file) {
    body += '--test\r\n'
    body += 'Content-Disposition: form-data; name="arquivo"; filename="doc.pdf"\r\n'
    body += 'Content-Type: application/pdf\r\n\r\n'
    body += file.toString('latin1')
    body += '\r\n'
  }
  if (tipo) {
    body += '--test\r\n'
    body += 'Content-Disposition: form-data; name="tipo"\r\n\r\n'
    body += tipo
    body += '\r\n'
  }
  body += '--test--\r\n'
  return body
}

/** Aguarda a transcrição sair de "processando" (o processamento roda no slot da fila). */
async function waitForDone(
  app: FastifyInstance,
  id: string,
  timeoutMs = 5_000,
): Promise<{ status: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await app.inject({ method: 'GET', url: `/api/transcricoes/${id}` })
    const body = res.json()
    if (body.status !== 'processando') return body
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error('timeout aguardando processamento')
}
