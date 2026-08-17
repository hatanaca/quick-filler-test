import { randomBytes } from 'node:crypto'

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test'
  port: number
  host: string
  uploadMaxSizeBytes: number
  uploadMaxConcurrentPerIp: number
  processingTimeoutMs: number
  retentionMinutes: number
  corsOrigin: string
  rateLimitMax: number
  rateLimitWindowMs: number
  tesseractLang: string
  ocrWorkerPoolSize: number
  trustProxy: readonly (string | number)[]
  pdfRenderScale: number
  ocrConfidenceThreshold: number
  ocrPreprocess: 'off' | 'auto' | 'color' | 'grayscale'
  ocrPsm: number
  ocrWhitelist: string
  jwtSecret: string
}

function numberFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Retenção e timeout zerados/negativos criariam setInterval/setTimeout(0) —
 *  loop apertado que apagaria tudo ou faria todo processamento falhar. */
function positiveFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = numberFromEnv(env, name, fallback)
  return value > 0 ? value : fallback
}

const WEAK_JWT_SECRETS: ReadonlySet<string> = new Set([
  'your-production-secret-key-here',
  'your-secret-key-here',
  'secret',
  'password',
  'changeme',
  'jwt-secret',
  'supersecret',
  'my-secret',
  'test-secret',
])

const MIN_JWT_SECRET_LENGTH = 32

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const uploadMaxSizeMb = positiveFromEnv(env, 'UPLOAD_MAX_SIZE_MB', 20)

  // Generate a random secret for development/test; in production, use a strong secret
  const nodeEnv = (env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development'
  const rawSecret = env.JWT_SECRET

  if (nodeEnv === 'production') {
    if (!rawSecret) {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    if (WEAK_JWT_SECRETS.has(rawSecret)) {
      throw new Error(
        'JWT_SECRET is a known placeholder. Generate a strong secret: openssl rand -base64 32',
      )
    }
    if (rawSecret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters. Generate: openssl rand -base64 32`,
      )
    }
  }

  const jwtSecret = rawSecret ?? 'dev-secret-' + randomBytes(24).toString('hex')

  return {
    nodeEnv: (env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: numberFromEnv(env, 'PORT', 3001),
    host: env.HOST ?? '0.0.0.0',
    uploadMaxSizeBytes: uploadMaxSizeMb * 1024 * 1024,
    uploadMaxConcurrentPerIp: positiveFromEnv(env, 'UPLOAD_MAX_CONCURRENT_PER_IP', 3),
    processingTimeoutMs: positiveFromEnv(env, 'PROCESSING_TIMEOUT_MS', 60_000),
    retentionMinutes: positiveFromEnv(env, 'RETENTION_MINUTES', 60),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    rateLimitMax: positiveFromEnv(env, 'RATE_LIMIT_MAX', 300),
    rateLimitWindowMs: positiveFromEnv(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
    tesseractLang: env.TESSERACT_LANG ?? 'por',
    ocrWorkerPoolSize: positiveFromEnv(env, 'OCR_WORKER_POOL_SIZE', 2),
    pdfRenderScale: positiveFromEnv(env, 'PDF_RENDER_SCALE', 5),
    ocrConfidenceThreshold: positiveFromEnv(env, 'OCR_CONFIDENCE_THRESHOLD', 60),
    ocrPreprocess: (env.OCR_PREPROCESS as AppConfig['ocrPreprocess']) ?? 'auto',
    ocrPsm: positiveFromEnv(env, 'OCR_PSM', 6),
    ocrWhitelist: env.OCR_WHITELIST ?? '',
    // CIDRs separados por vírgula; default apenas loopback (anti-spoofing).
    // Em deploy atrás de nginx em rede Docker, incluir a sub-rede do proxy
    // (ex.: "loopback,172.16.0.0/12") para o rate limit/fila verem o IP real.
    trustProxy: (env.TRUST_PROXY ?? 'loopback')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    jwtSecret,
  }
}
