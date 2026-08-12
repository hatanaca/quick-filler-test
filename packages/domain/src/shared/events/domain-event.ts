export interface DomainEvent {
  readonly type: string
  readonly occurredAt: Date
}

export class TranscriptionCreated implements DomainEvent {
  readonly type = 'transcription.created'
  readonly occurredAt: Date

  constructor(
    readonly id: { value: string },
    readonly tipo: string,
  ) {
    this.occurredAt = new Date()
  }
}

export class TranscriptionCompleted implements DomainEvent {
  readonly type = 'transcription.completed'
  readonly occurredAt: Date

  constructor(
    readonly id: { value: string },
    readonly tipo: string,
    readonly pageCount: number,
  ) {
    this.occurredAt = new Date()
  }
}

export class TranscriptionFailed implements DomainEvent {
  readonly type = 'transcription.failed'
  readonly occurredAt: Date

  constructor(
    readonly id: { value: string },
    readonly error: string,
  ) {
    this.occurredAt = new Date()
  }
}

export class TranscriptionUpdated implements DomainEvent {
  readonly type = 'transcription.updated'
  readonly occurredAt: Date

  constructor(readonly id: { value: string }) {
    this.occurredAt = new Date()
  }
}
