import Fastify, { type FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import compress from '@fastify/compress'
import multipart from '@fastify/multipart'
import type {
  CreateTranscriptionUseCase,
  ExportSpreadsheetUseCase,
  GetTranscriptionUseCase,
  ProcessTranscriptionUseCase,
  UpdateTranscriptionUseCase,
} from '@quickfiller/application'
import type { AppConfig } from './config.js'
import { createLoggerOptions } from './middleware/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { registerHealthz } from './routes/healthz.route.js'
import { registerTranscriptionRoutes } from './routes/transcricoes.route.js'

export interface AppDeps {
  config: AppConfig
  createTranscription: CreateTranscriptionUseCase
  getTranscription: GetTranscriptionUseCase
  updateTranscription: UpdateTranscriptionUseCase
  processTranscription: ProcessTranscriptionUseCase
  exportSpreadsheet: ExportSpreadsheetUseCase
}

export function buildApp(deps: AppDeps): FastifyInstance {
  // O objeto de logger customizado altera a inferência de tipos do Fastify;
  // o cast mantém o generic padrão (RawServerDefault) nos handlers.
  const app = Fastify({
    logger: createLoggerOptions(deps.config.nodeEnv === 'development' ? 'debug' : 'info'),
    bodyLimit: deps.config.uploadMaxSizeBytes,
    trustProxy: true,
  } as Parameters<typeof Fastify>[0]) as unknown as FastifyInstance

  app.register(multipart, { limits: { fileSize: deps.config.uploadMaxSizeBytes } })
  app.register(helmet)
  app.register(cors, { origin: deps.config.corsOrigin.split(',') })
  app.register(rateLimit, {
    max: deps.config.rateLimitMax,
    timeWindow: deps.config.rateLimitWindowMs,
  })
  app.register(compress)

  app.setErrorHandler(errorHandler)

  registerHealthz(app)
  registerTranscriptionRoutes(app, {
    createTranscription: deps.createTranscription,
    getTranscription: deps.getTranscription,
    updateTranscription: deps.updateTranscription,
    processTranscription: deps.processTranscription,
    exportSpreadsheet: deps.exportSpreadsheet,
    uploadMaxSizeBytes: deps.config.uploadMaxSizeBytes,
  })

  return app
}
