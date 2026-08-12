import type { FastifyBaseLogger } from 'fastify'

export interface UploadValidator {
  isValid(buffer: Buffer): boolean
}

/**
 * Fila de processamento em memória: mantém a contagem de uploads
 * simultâneos por IP (limite configurável) e processa transcrições
 * em background — nunca dentro do request HTTP.
 */
export class ProcessingQueue {
  private readonly perIp: Map<string, number> = new Map()

  constructor(
    private readonly maxConcurrentPerIp: number,
    private readonly logger: FastifyBaseLogger,
  ) {}

  acquire(ip: string): boolean {
    const current = this.perIp.get(ip) ?? 0
    if (current >= this.maxConcurrentPerIp) return false
    this.perIp.set(ip, current + 1)
    return true
  }

  release(ip: string): void {
    const current = this.perIp.get(ip) ?? 0
    if (current <= 1) this.perIp.delete(ip)
    else this.perIp.set(ip, current - 1)
  }

  async run(ip: string, task: () => Promise<void>): Promise<void> {
    if (!this.acquire(ip)) {
      throw new Error('muitos uploads simultâneos para este IP')
    }
    try {
      await task()
    } finally {
      this.release(ip)
    }
  }
}

export function isUploadTooLarge(buffer: Buffer, maxBytes: number): boolean {
  return buffer.length > maxBytes
}
