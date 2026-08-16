import type { Transcription, TranscriptionId, TranscriptionRepository } from '@quickfiller/domain'

/**
 * Repositório em memória — suficiente para o desafio (retenção curta,
 * sem banco). Trocar por SQLite/Postgres implementando a mesma interface.
 */
export class InMemoryTranscriptionRepository implements TranscriptionRepository {
  private readonly items = new Map<string, Transcription>()
  private readonly createdAt = new Map<string, Date>()

  async save(transcription: Transcription): Promise<void> {
    this.items.set(transcription.id.value, transcription)
    if (!this.createdAt.has(transcription.id.value)) {
      this.createdAt.set(transcription.id.value, new Date())
    }
  }

  async findById(id: TranscriptionId): Promise<Transcription | null> {
    return this.items.get(id.value) ?? null
  }

  async delete(id: TranscriptionId): Promise<void> {
    this.items.delete(id.value)
    this.createdAt.delete(id.value)
  }

  /** Remove transcrições mais velhas que o período de retenção e devolve os ids removidos. */
  async deleteOlderThan(ageMs: number): Promise<string[]> {
    const cutoff = Date.now() - ageMs
    const removed: string[] = []
    for (const [id, createdAt] of this.createdAt) {
      if (createdAt.getTime() < cutoff) {
        this.items.delete(id)
        this.createdAt.delete(id)
        removed.push(id)
      }
    }
    return removed
  }
}
