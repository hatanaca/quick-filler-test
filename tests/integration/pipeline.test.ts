import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
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
import { InMemoryTranscriptionRepository, DiskFileStorage } from '@quickfiller/infrastructure'
import { PdfJsExtractorAdapter, ExcelJsGeneratorAdapter } from '@quickfiller/infrastructure'
import type { TranscriptionRepository, FileStoragePort, OcrEnginePort } from '@quickfiller/domain'

const FIXTURES = join(__dirname, '..', 'fixtures', 'pdfs')

class NoopOcr implements OcrEnginePort {
  async recognize(): Promise<string> {
    return ''
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

function multipart(
  fileBuffer: Buffer,
  tipo: string,
  boundary: string,
): { payload: Buffer; headers: Record<string, string> } {
  const filePart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="arquivo"; filename="doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
  )
  const tipoPart = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="tipo"\r\n\r\n${tipo}\r\n`,
  )
  const footer = Buffer.from(`--${boundary}--\r\n`)
  return {
    payload: Buffer.concat([filePart, fileBuffer, tipoPart, footer]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

async function waitForDone(
  app: FastifyInstance,
  id: string,
  timeoutMs = 10_000,
): Promise<{ status: string; value: unknown; erro: string | null }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await app.inject({ method: 'GET', url: `/api/transcricoes/${id}` })
    const body = res.json()
    if (body.status !== 'processando') return body
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('timeout aguardando processamento')
}

describe('Pipeline E2E — PDF real com texto embutido', () => {
  let app: FastifyInstance
  let repo: TranscriptionRepository
  let storage: FileStoragePort

  beforeAll(async () => {
    repo = new InMemoryTranscriptionRepository()
    storage = new DiskFileStorage(join(FIXTURES, '..', 'uploads-tmp'))
    await (storage as DiskFileStorage).init()
    const bus = new InMemoryEventBus()
    app = buildApp({
      config,
      createTranscription: new CreateTranscriptionUseCase(repo, storage, bus),
      getTranscription: new GetTranscriptionUseCase(repo),
      updateTranscription: new UpdateTranscriptionUseCase(repo),
      processTranscription: new ProcessTranscriptionUseCase(
        repo,
        storage,
        new PdfJsExtractorAdapter(),
        new NoopOcr(),
      ),
      exportSpreadsheet: new ExportSpreadsheetUseCase(repo, new ExcelJsGeneratorAdapter()),
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('cartão de ponto: enviar → processar → revisar → baixar (ciclo completo)', async () => {
    const pdf = await readFile(join(FIXTURES, 'cartao-ponto-teste.pdf'))
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      ...multipart(pdf, 'cartao-ponto', 'e2e1'),
    })
    expect(post.statusCode).toBe(202)
    const { id } = post.json()

    const done = await waitForDone(app, id)
    expect(done.status).toBe('concluido')
    expect(done.value).not.toBeNull()

    const value = done.value as {
      pages: { page: number; days: { date_raw: string; punches: { kind: string }[] }[] }[]
    }
    expect(value.pages).toHaveLength(1)
    const days = value.pages[0]?.days ?? []
    expect(days.length).toBeGreaterThanOrEqual(5)
    expect(days[0]?.date_raw).toBe('21/05/2019')
    expect(days[0]?.punches).toHaveLength(4)
    // dias sem batida são linhas válidas (25/05)
    expect(days[days.length - 1]?.punches).toHaveLength(0)

    // download em 3 formatos
    for (const formato of ['xlsx', 'csv', 'json']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/transcricoes/${id}/planilha?formato=${formato}`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.rawPayload.length).toBeGreaterThan(0)
    }
  })

  it('holerite: separa fields (verbas) de bases (seção separada)', async () => {
    const pdf = await readFile(join(FIXTURES, 'holerite-teste.pdf'))
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      ...multipart(pdf, 'holerite', 'e2e2'),
    })
    const { id } = post.json()

    const done = await waitForDone(app, id)
    expect(done.status).toBe('concluido')

    const value = done.value as {
      pages: {
        year: string
        month: string
        fields: { label: string; value: string }[]
        bases: { label: string; value: string }[]
      }[]
    }
    const page = value.pages[0]
    expect(page?.year).toBe('2019')
    expect(page?.month).toBe('05')
    expect(page?.fields.some((f) => f.label === 'Salário Base')).toBe(true)
    expect(page?.fields.some((f) => f.label === 'Horas Extras - 50%')).toBe(true)
    // bases NÃO podem estar em fields — separação é a decisão central
    for (const base of ['Base INSS', 'Total Vencimentos', 'Valor Líquido']) {
      expect(page?.fields.some((f) => f.label === base)).toBe(false)
      expect(page?.bases.some((b) => b.label === base)).toBe(true)
    }
  })

  it('PDF corrompido (não-PDF com magic bytes falsos) → status ERRO legível', async () => {
    const fake = Buffer.from('%PDF-1.4 ' + 'lixo'.repeat(100))
    const post = await app.inject({
      method: 'POST',
      url: '/api/transcricoes',
      ...multipart(fake, 'cartao-ponto', 'e2e3'),
    })
    expect(post.statusCode).toBe(202)
    const { id } = post.json()

    const done = await waitForDone(app, id, 15_000)
    expect(done.status).toBe('erro')
    expect(done.erro).toBeTruthy()
    expect(done.value).toBeNull()
  })
})
