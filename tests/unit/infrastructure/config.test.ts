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

  describe('JWT_SECRET validation in production', () => {
    it('rejeita JWT_SECRET ausente em produção', () => {
      expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
        'JWT_SECRET environment variable is required in production',
      )
    })

    it('rejeita JWT_SECRET placeholder em produção', () => {
      expect(() =>
        loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'your-production-secret-key-here' }),
      ).toThrow('JWT_SECRET is a known placeholder')
    })

    it('rejeita JWT_SECRET curto em produção', () => {
      expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(
        'JWT_SECRET must be at least 32 characters',
      )
    })

    it('aceita JWT_SECRET forte em produção', () => {
      const config = loadConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32),
      })
      expect(config.jwtSecret).toBe('a'.repeat(32))
    })

    it('aceita JWT_SECRET ausente em desenvolvimento (gera aleatório)', () => {
      const config = loadConfig({ NODE_ENV: 'development' })
      expect(config.jwtSecret).toMatch(/^dev-secret-/)
    })
  })
})
