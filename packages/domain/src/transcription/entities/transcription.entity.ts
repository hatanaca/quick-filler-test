import { DomainError } from '../../shared/errors/domain.error.js'
import {
  TranscriptionCreated,
  TranscriptionCompleted,
  TranscriptionFailed,
  TranscriptionUpdated,
  type DomainEvent,
} from '../../shared/events/domain-event.js'
import { type DocumentType, isDocumentType } from '../value-objects/document-type.vo.js'
import { TranscriptionStatus } from '../value-objects/transcription-status.vo.js'
import type { TranscriptionId } from '../value-objects/transcription-id.vo.js'
import type { TranscriptionResult } from '../value-objects/transcription-result.vo.js'

export interface CreateTranscriptionParams {
  id: TranscriptionId
  tipo: string
  createdAt?: Date
}

export class Transcription {
  private readonly _id: TranscriptionId
  private readonly _tipo: DocumentType
  private _status: TranscriptionStatus
  private _erro: string | null
  private _value: TranscriptionResult | null
  private readonly _createdAt: Date
  private _updatedAt: Date
  private readonly _events: DomainEvent[] = []

  private constructor(params: CreateTranscriptionParams) {
    if (!isDocumentType(params.tipo)) {
      throw new DomainError(`tipo inválido: "${params.tipo}" (esperado cartao-ponto ou holerite)`)
    }
    this._id = params.id
    this._tipo = params.tipo
    this._status = TranscriptionStatus.PROCESSANDO
    this._erro = null
    this._value = null
    this._createdAt = params.createdAt ?? new Date()
    this._updatedAt = this._createdAt
  }

  static create(params: CreateTranscriptionParams): Transcription {
    const entity = new Transcription(params)
    entity._events.push(new TranscriptionCreated(entity._id, entity._tipo))
    return entity
  }

  get id(): TranscriptionId {
    return this._id
  }

  get tipo(): DocumentType {
    return this._tipo
  }

  get status(): TranscriptionStatus {
    return this._status
  }

  get erro(): string | null {
    return this._erro
  }

  get value(): TranscriptionResult | null {
    return this._value
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  complete(result: TranscriptionResult): void {
    this.assertTransitionTo(TranscriptionStatus.CONCLUIDO)
    this._status = TranscriptionStatus.CONCLUIDO
    this._value = result
    this._updatedAt = new Date()
    const pageCount = result.pages.length
    this._events.push(new TranscriptionCompleted(this._id, this._tipo, pageCount))
  }

  fail(error: string): void {
    if (!error.trim()) throw new DomainError('erro não pode ser vazio')
    this.assertTransitionTo(TranscriptionStatus.ERRO)
    this._status = TranscriptionStatus.ERRO
    this._erro = error
    this._updatedAt = new Date()
    this._events.push(new TranscriptionFailed(this._id, error))
  }

  updateValue(value: TranscriptionResult): void {
    if (this._status !== TranscriptionStatus.CONCLUIDO) {
      throw new DomainError(
        `só é possível corrigir transcrição concluída (status atual: ${this._status})`,
      )
    }
    this._value = value
    this._updatedAt = new Date()
    this._events.push(new TranscriptionUpdated(this._id))
  }

  pullEvents(): DomainEvent[] {
    const events = [...this._events]
    this._events.length = 0
    return events
  }

  private assertTransitionTo(target: TranscriptionStatus): void {
    const allowed =
      this._status === TranscriptionStatus.PROCESSANDO &&
      (target === TranscriptionStatus.CONCLUIDO || target === TranscriptionStatus.ERRO)
    if (!allowed) {
      throw new DomainError(
        `transição inválida de status "${this._status}" para "${target}"`,
      )
    }
  }
}
