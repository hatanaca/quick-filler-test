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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const uploadMaxSizeMb = positiveFromEnv(env, 'UPLOAD_MAX_SIZE_MB', 20)
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
    pdfRenderScale: positiveFromEnv(env, 'PDF_RENDER_SCALE', 4),
    ocrConfidenceThreshold: positiveFromEnv(env, 'OCR_CONFIDENCE_THRESHOLD', 40),
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
  }
}
