import type { DomainEvent } from '@quickfiller/domain'

export interface EventBus {
  subscribe(handler: (event: DomainEvent) => void): () => void
  publish(event: DomainEvent): void
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers: ((event: DomainEvent) => void)[] = []

  subscribe(handler: (event: DomainEvent) => void): () => void {
    this.handlers.push(handler)
    // unsubscribe — evita acúmulo de handlers ao longo da vida do processo
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index >= 0) this.handlers.splice(index, 1)
    }
  }

  publish(event: DomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (error) {
        // Um handler que lança não pode interromper os demais nem derrubar o
        // publish — o agregado já foi persistido neste ponto.
        console.error('[event-bus] handler falhou ao processar', event.type, error)
      }
    }
  }
}
