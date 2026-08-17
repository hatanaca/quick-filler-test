import Fastify, { type FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import compress from '@fastify/compress'
import multipart from '@fastify/multipart'
import cookie from '@fastify/cookie'
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
import { ProcessingQueue } from './middleware/queue.js'
import { registerJwt } from './middleware/auth.js'
import { registerHealthz } from './routes/healthz.route.js'
import { registerAuthRoutes } from './routes/auth.route.js'
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
    // Folga de 1MB além do limite do arquivo para o overhead do multipart:
    // bodyLimit == limite do arquivo fazia uploads no teto falharem com 413.
    bodyLimit: deps.config.uploadMaxSizeBytes + 1024 * 1024,
    // Confia em X-Forwarded-* apenas de proxies listados (TRUST_PROXY).
    // Default: loopback. Em deploy atrás de nginx em rede Docker, a sub-rede
    // do proxy deve ser incluída (ex.: "loopback,172.16.0.0/12") — com
    // trustProxy:true qualquer cliente spoofaria o IP e contornaria o rate
    // limit / limite por IP da fila de uploads.
    trustProxy: deps.config.trustProxy,
  } as Parameters<typeof Fastify>[0]) as unknown as FastifyInstance

  app.register(multipart, { limits: { fileSize: deps.config.uploadMaxSizeBytes } })

  // Register cookie plugin for refresh tokens
  app.register(cookie)

  // Configure Helmet with explicit CSP for security
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for React/Vite dev
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind
        imgSrc: ["'self'", 'data:', 'blob:'], // Required for PDF rendering
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        connectSrc: ["'self'"], // API calls
        workerSrc: ["'self'", 'blob:'], // Required for PDF.js worker
        childSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: deps.config.nodeEnv === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Required for PDF.js
    crossOriginResourcePolicy: false, // Required for PDF.js
  })

  app.register(cors, {
    origin: deps.config.corsOrigin.split(','),
    credentials: true, // Allow cookies for refresh tokens
  })
  app.register(rateLimit, {
    max: deps.config.rateLimitMax,
    timeWindow: deps.config.rateLimitWindowMs,
  })
  app.register(compress)

  // Register JWT for authentication
  registerJwt(app, deps.config.jwtSecret)

  app.setErrorHandler(errorHandler)

  const uploadQueue = new ProcessingQueue(deps.config.uploadMaxConcurrentPerIp, app.log)

  registerHealthz(app)

  // Auth routes (login, refresh, logout - no auth required)
  registerAuthRoutes(app)

  // Protected transcription routes
  registerTranscriptionRoutes(app, {
    createTranscription: deps.createTranscription,
    getTranscription: deps.getTranscription,
    updateTranscription: deps.updateTranscription,
    processTranscription: deps.processTranscription,
    exportSpreadsheet: deps.exportSpreadsheet,
    uploadMaxSizeBytes: deps.config.uploadMaxSizeBytes,
    uploadQueue,
  })

  return app
}
