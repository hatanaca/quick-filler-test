import { afterEach, describe, expect, it, vi } from 'vitest'
import { InMemoryTranscriptionRepository } from '@quickfiller/infrastructure'
import { Transcription, TranscriptionId, DocumentType } from '@quickfiller/domain'

function save(repo: InMemoryTranscriptionRepository, id: string): void {
  const t = Transcription.create({ id: TranscriptionId.from(id), tipo: DocumentType.CARTAO_PONTO })
  void repo.save(t)
}

describe('InMemoryTranscriptionRepository.deleteOlderThan', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('remove entradas expiradas e devolve os ids removidos', async () => {
    const repo = new InMemoryTranscriptionRepository()

    // "cria" a entrada velha 2min atrás; o repo registra createdAt no save
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.now() - 120_000))
    save(repo, '00000000-0000-4000-8000-000000000001')
    vi.useRealTimers()
    save(repo, '00000000-0000-4000-8000-000000000002') // recente

    const removed = await repo.deleteOlderThan(60_000)

    expect(removed).toEqual(['00000000-0000-4000-8000-000000000001'])
    expect(
      await repo.findById(TranscriptionId.from('00000000-0000-4000-8000-000000000001')),
    ).toBeNull()
    expect(
      await repo.findById(TranscriptionId.from('00000000-0000-4000-8000-000000000002')),
    ).not.toBeNull()
  })

  it('retorna array vazio quando nada expirou', async () => {
    const repo = new InMemoryTranscriptionRepository()
    save(repo, '00000000-0000-4000-8000-000000000001')
    expect(await repo.deleteOlderThan(60_000)).toEqual([])
  })
})
