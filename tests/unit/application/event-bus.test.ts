import { describe, expect, it } from 'vitest'
import { InMemoryEventBus } from '@quickfiller/application'

describe('InMemoryEventBus', () => {
  it('um handler que lança não impede os demais de receberem o evento', () => {
    const bus = new InMemoryEventBus()
    const received: string[] = []
    bus.subscribe(() => {
      throw new Error('handler quebrado')
    })
    bus.subscribe((event) => received.push(event.type))

    expect(() => bus.publish({ type: 'test.event', occurredAt: new Date() })).not.toThrow()
    expect(received).toEqual(['test.event'])
  })

  it('unsubscribe remove o handler', () => {
    const bus = new InMemoryEventBus()
    const received: string[] = []
    const unsubscribe = bus.subscribe((event) => received.push(event.type))
    unsubscribe()
    bus.publish({ type: 'test.event', occurredAt: new Date() })
    expect(received).toEqual([])
  })
})
