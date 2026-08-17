import type { FastifyBaseLogger } from 'fastify'

const STALE_ENTRY_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fila de processamento em memória: mantém a contagem de uploads
 * simultâneos por IP (limite configurável) e processa transcrições
 * em background — nunca dentro do request HTTP.
 */
export class ProcessingQueue {
  private readonly perIp: Map<string, number> = new Map()
  private readonly perIpTimestamps: Map<string, number> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly maxConcurrentPerIp: number,
    private readonly logger: FastifyBaseLogger,
  ) {
    // Periodic cleanup of stale entries to prevent memory leak
    this.cleanupTimer = setInterval(() => this.cleanupStaleEntries(), STALE_ENTRY_TTL_MS)
    this.cleanupTimer.unref()
  }

  acquire(ip: string): boolean {
    const current = this.perIp.get(ip) ?? 0
    if (current >= this.maxConcurrentPerIp) return false
    this.perIp.set(ip, current + 1)
    this.perIpTimestamps.set(ip, Date.now())
    return true
  }

  release(ip: string): void {
    const current = this.perIp.get(ip) ?? 0
    if (current <= 1) {
      this.perIp.delete(ip)
      this.perIpTimestamps.delete(ip)
    } else {
      this.perIp.set(ip, current - 1)
      this.perIpTimestamps.set(ip, Date.now())
    }
  }

  async run<T>(ip: string, task: () => Promise<T>): Promise<T> {
    if (!this.acquire(ip)) {
      const error = new Error('muitos uploads simultâneos para este IP') as Error & {
        statusCode: number
      }
      error.statusCode = 429
      throw error
    }
    try {
      return await task()
    } finally {
      this.release(ip)
    }
  }

  private cleanupStaleEntries(): void {
    const now = Date.now()
    for (const [ip, timestamp] of this.perIpTimestamps) {
      if (now - timestamp > STALE_ENTRY_TTL_MS) {
        this.perIp.delete(ip)
        this.perIpTimestamps.delete(ip)
      }
    }
  }
}

export function isUploadTooLarge(buffer: Buffer, maxBytes: number): boolean {
  return buffer.length > maxBytes
}
