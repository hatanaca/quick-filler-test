export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export class InvalidDocumentError extends DomainError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDocumentError'
  }
}

export class TranscriptionNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Transcrição não encontrada: ${id}`)
    this.name = 'TranscriptionNotFoundError'
  }
}
