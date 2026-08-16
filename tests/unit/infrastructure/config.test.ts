import { describe, expect, it } from 'vitest'
import { loadConfig } from '@quickfiller/infrastructure'

describe('loadConfig', () => {
  it('usa valores padrão quando o ambiente não define nada', () => {
    const config = loadConfig({})
    expect(config.retentionMinutes).toBe(60)
    expect(config.processingTimeoutMs).toBe(60_000)
    expect(config.ocrWorkerPoolSize).toBe(2)
    expect(config.uploadMaxSizeBytes).toBe(20 * 1024 * 1024)
    expect(config.trustProxy).toEqual(['loopback'])
  })

  it('aceita valores positivos válidos', () => {
    const config = loadConfig({
      RETENTION_MINUTES: '30',
      PROCESSING_TIMEOUT_MS: '5000',
      OCR_WORKER_POOL_SIZE: '4',
      TRUST_PROXY: 'loopback,172.16.0.0/12',
    })
    expect(config.retentionMinutes).toBe(30)
    expect(config.processingTimeoutMs).toBe(5000)
    expect(config.ocrWorkerPoolSize).toBe(4)
    expect(config.trustProxy).toEqual(['loopback', '172.16.0.0/12'])
  })

  it('rejeita valores zerados/negativos (fallback ao padrão) para não criar setInterval(0)', () => {
    const config = loadConfig({
      RETENTION_MINUTES: '0',
      PROCESSING_TIMEOUT_MS: '-1',
      OCR_WORKER_POOL_SIZE: '0',
      RATE_LIMIT_MAX: '0',
      UPLOAD_MAX_SIZE_MB: '0',
    })
    expect(config.retentionMinutes).toBe(60)
    expect(config.processingTimeoutMs).toBe(60_000)
    expect(config.ocrWorkerPoolSize).toBe(2)
    expect(config.rateLimitMax).toBe(300)
    expect(config.uploadMaxSizeBytes).toBe(20 * 1024 * 1024)
  })

  it('ignora valores não numéricos (fallback ao padrão)', () => {
    const config = loadConfig({ RETENTION_MINUTES: 'abc' })
    expect(config.retentionMinutes).toBe(60)
  })
})
