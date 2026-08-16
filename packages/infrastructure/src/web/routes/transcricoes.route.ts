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
  app.post('/api/transcricoes', async (request: FastifyRequest, reply) => {
    // O slot da fila cobre upload E processamento: o limite per-IP deixa de ser
    // contornado por N uploads sequenciais que disparam N jobs concorrentes.
    return deps.uploadQueue.run(request.ip, async () => {
      const parts = request.parts()
      let arquivo: Buffer | null = null
      let tipo: string | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
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
        throw new DomainError('campos obrigatórios: arquivo (PDF) e tipo (cartao-ponto | holerite)')
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

      try {
        await deps.processTranscription.execute(TranscriptionId.from(id.value))
      } catch (error) {
        app.log.error(error, `falha ao processar transcrição ${id.value}`)
      }
    })
  })

  app.get('/api/transcricoes/:id', async (request) => {
    const { id } = request.params as { id: string }
    return deps.getTranscription.execute(TranscriptionId.from(id))
  })

  app.put('/api/transcricoes/:id', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { value?: unknown }
    if (!body || typeof body !== 'object' || !('value' in body)) {
      throw new DomainError('body deve conter o campo "value"')
    }
    const transcription = await deps.getTranscription.execute(TranscriptionId.from(id))
    const value = parseResult(transcription.tipo as 'cartao-ponto' | 'holerite', body.value)
    await deps.updateTranscription.execute({ id: TranscriptionId.from(id), value })
    return { id }
  })

  app.get('/api/transcricoes/:id/planilha', async (request, reply) => {
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
  })
}
