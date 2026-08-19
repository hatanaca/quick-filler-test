import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  type CreateTranscriptionUseCase,
  type ExportSpreadsheetUseCase,
  type GetTranscriptionUseCase,
  type ProcessTranscriptionUseCase,
  type UpdateTranscriptionUseCase,
  parseResult,
} from '@quickfiller/application'
import {
  DomainError,
  ExportFormat,
  TranscriptionId,
  isDocumentType,
  isExportFormat,
} from '@quickfiller/domain'
import { verifyToken } from '../middleware/auth.js'
import { isPdfMagicBytes } from '../middleware/upload.js'
import { isUploadTooLarge, type ProcessingQueue } from '../middleware/queue.js'

export interface TranscriptionRoutesDeps {
  createTranscription: CreateTranscriptionUseCase
  getTranscription: GetTranscriptionUseCase
  updateTranscription: UpdateTranscriptionUseCase
  processTranscription: ProcessTranscriptionUseCase
  exportSpreadsheet: ExportSpreadsheetUseCase
  uploadMaxSizeBytes: number
  uploadQueue: ProcessingQueue
}

export function registerTranscriptionRoutes(
  app: FastifyInstance,
  deps: TranscriptionRoutesDeps,
): void {
  /**
   * POST /api/transcricoes
   * Create a new transcription (requires authentication)
   */
  app.post(
    '/api/transcricoes',
    { preHandler: [verifyToken] },
    async (request: FastifyRequest, reply) => {
      // O slot da fila cobre upload E processamento: o limite per-IP deixa de ser
      // contornado por N uploads sequenciais que disparam N jobs concorrentes.
      return deps.uploadQueue.run(request.ip, async () => {
        const parts = request.parts()
        let arquivo: Buffer | null = null
        let tipo: string | null = null

        for await (const part of parts) {
          if (part.type === 'file') {
            // Um segundo campo 'arquivo' concatenaria dois PDFs em um buffer
            // corrompido — rejeita imediatamente em vez de falhar no OCR.
            if (part.fieldname === 'arquivo' && arquivo !== null) {
              throw new DomainError('apenas um arquivo é aceito por upload')
            }
            const chunks: Buffer[] = []
            let total = 0
            // Drena o stream de TODAS as file parts — deixar uma parte sem
            // consumir pendura o parser do multipart até o timeout da requisição.
            for await (const chunk of part.file) {
              if (part.fieldname !== 'arquivo') continue
              chunks.push(chunk as Buffer)
              total += chunk.length
              if (total > deps.uploadMaxSizeBytes) {
                throw new DomainError(
                  `arquivo excede o limite de ${Math.floor(deps.uploadMaxSizeBytes / 1024 / 1024)}MB`,
                )
              }
            }
            if (part.fieldname === 'arquivo') arquivo = Buffer.concat(chunks)
          } else if (part.type === 'field' && part.fieldname === 'tipo') {
            tipo = String(part.value)
          }
        }

        if (!arquivo || !tipo) {
          throw new DomainError(
            'campos obrigatórios: arquivo (PDF) e tipo (cartao-ponto | holerite)',
          )
        }
        if (!isDocumentType(tipo)) {
          throw new DomainError(`tipo inválido: "${tipo}" (esperado cartao-ponto ou holerite)`)
        }
        if (!isPdfMagicBytes(arquivo)) {
          throw new DomainError('arquivo não é um PDF válido')
        }
        if (isUploadTooLarge(arquivo, deps.uploadMaxSizeBytes)) {
          throw new DomainError('arquivo excede o limite de tamanho')
        }

        const id = await deps.createTranscription.execute({
          tipo,
          arquivo,
          nomeArquivo: 'upload.pdf',
        })

        // 202 imediato para o cliente; o processamento segue no slot da fila.
        reply.status(202)
        await reply.send({ id: id.value })

        // Processamento em background: liberar o slot da fila imediatamente
        // para não bloquear outras requisições do mesmo IP. O processamento
        // roda em setImmediate para que o event loop volte ao handler antes
        // de iniciar o trabalho pesado (OCR, renderização de PDF).
        const transcriptionId = TranscriptionId.from(id.value)
        setImmediate(async () => {
          try {
            await deps.processTranscription.execute(transcriptionId)
          } catch (error) {
            app.log.error(error, `falha ao processar transcrição ${id.value}`)
          }
        })
      })
    },
  )

  /**
   * GET /api/transcricoes/:id
   * Get a transcription by ID (requires authentication)
   */
  app.get('/api/transcricoes/:id', { preHandler: [verifyToken] }, async (request) => {
    const { id } = request.params as { id: string }
    return deps.getTranscription.execute(TranscriptionId.from(id))
  })

  /**
   * PUT /api/transcricoes/:id
   * Update a transcription (requires authentication)
   */
  app.put('/api/transcricoes/:id', { preHandler: [verifyToken] }, async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { value?: unknown }
    if (!body || typeof body !== 'object' || !('value' in body)) {
      throw new DomainError('body deve conter o campo "value"')
    }
    const transcriptionId = TranscriptionId.from(id)
    const transcription = await deps.getTranscription.execute(transcriptionId)
    const value = parseResult(transcription.tipo as 'cartao-ponto' | 'holerite', body.value)
    await deps.updateTranscription.execute({ id: transcriptionId, value })
    return { id }
  })

  /**
   * GET /api/transcricoes/:id/planilha
   * Download spreadsheet (requires authentication)
   */
  app.get(
    '/api/transcricoes/:id/planilha',
    { preHandler: [verifyToken] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const query = request.query as { formato?: string }
      const formato = query.formato ?? ExportFormat.XLSX
      if (!isExportFormat(formato)) {
        throw new DomainError('formato inválido (esperado xlsx, csv ou json)')
      }

      const generated = await deps.exportSpreadsheet.execute({
        id: TranscriptionId.from(id),
        formato,
      })

      reply.header('Content-Type', generated.mimeType)
      reply.header(
        'Content-Disposition',
        `attachment; filename="transcricao-${id}.${generated.extension}"`,
      )
      return generated.buffer
    },
  )
}
