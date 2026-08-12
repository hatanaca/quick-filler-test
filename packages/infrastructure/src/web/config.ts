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
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const uploadMaxSizeMb = numberFromEnv('UPLOAD_MAX_SIZE_MB', 20)
  return {
    nodeEnv: (env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: numberFromEnv('PORT', 3001),
    host: env.HOST ?? '0.0.0.0',
    uploadMaxSizeBytes: uploadMaxSizeMb * 1024 * 1024,
    uploadMaxConcurrentPerIp: numberFromEnv('UPLOAD_MAX_CONCURRENT_PER_IP', 3),
    processingTimeoutMs: numberFromEnv('PROCESSING_TIMEOUT_MS', 60_000),
    retentionMinutes: numberFromEnv('RETENTION_MINUTES', 60),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    rateLimitMax: numberFromEnv('RATE_LIMIT_MAX', 100),
    rateLimitWindowMs: numberFromEnv('RATE_LIMIT_WINDOW_MS', 60_000),
    tesseractLang: env.TESSERACT_LANG ?? 'por',
    ocrWorkerPoolSize: numberFromEnv('OCR_WORKER_POOL_SIZE', 2),
  }
}
