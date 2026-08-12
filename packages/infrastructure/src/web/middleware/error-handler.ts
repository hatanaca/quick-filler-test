import type { FastifyReply, FastifyRequest } from 'fastify'
import { DomainError, TranscriptionNotFoundError } from '@quickfiller/domain'

/**
 * Converte erros de domínio em respostas HTTP adequadas:
 * - DomainError genérico → 400 (entrada inválida)
 * - TranscriptionNotFoundError → 404
 * - Erro inesperado → 500 com mensagem genérica (sem stack em produção)
 */
export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof TranscriptionNotFoundError) {
    reply.status(404).send({ erro: error.message })
    return
  }
  if (error instanceof DomainError) {
    reply.status(400).send({ erro: error.message })
    return
  }
  if (error instanceof Error && 'statusCode' in error) {
    const { statusCode } = error as { statusCode: number }
    if (statusCode >= 400 && statusCode < 500) {
      reply.status(statusCode).send({ erro: error.message })
      return
    }
  }

  request.log.error(error)
  reply.status(500).send({ erro: 'erro interno do servidor' })
}
