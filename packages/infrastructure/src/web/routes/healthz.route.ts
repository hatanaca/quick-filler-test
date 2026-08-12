import type { FastifyInstance } from 'fastify'

export function registerHealthz(app: FastifyInstance): void {
  app.get('/healthz', async () => {
    return { status: 'ok' }
  })
}
