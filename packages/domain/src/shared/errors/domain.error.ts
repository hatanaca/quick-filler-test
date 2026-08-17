export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class TranscriptionNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Transcrição não encontrada: ${id}`)
    this.name = 'TranscriptionNotFoundError'
  }
}
