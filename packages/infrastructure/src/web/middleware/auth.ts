import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

/**
 * Authentication middleware using JWT Bearer tokens.
 * Requires @fastify/jwt to be registered on the Fastify instance.
 */

export interface JWTPayload {
  sub: string
  email: string
  role: 'admin' | 'user'
  iat: number
  exp: number
}

/**
 * Verify JWT token from Authorization header.
 * Returns the decoded payload or throws an error.
 */
export async function verifyToken(
  this: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.status(401).send({ erro: 'Token de autenticação não fornecido' })
    }

    const decoded = this.jwt.verify<JWTPayload>(token)
    request.user = decoded
  } catch {
    return reply.status(401).send({ erro: 'Token inválido ou expirado' })
  }
}

/**
 * Generate access and refresh tokens for a user.
 */
export function generateTokens(
  this: FastifyInstance,
  user: { id: string; email: string; role: 'admin' | 'user' },
): { accessToken: string; refreshToken: string } {
  const accessToken = this.jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    { expiresIn: '15m' },
  )

  const refreshToken = this.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' })

  return { accessToken, refreshToken }
}

/**
 * Verify refresh token.
 */
export function verifyRefreshToken(this: FastifyInstance, token: string): { sub: string } | null {
  try {
    const decoded = this.jwt.verify<{ sub: string; type: string }>(token)
    if (decoded.type !== 'refresh') {
      return null
    }
    return { sub: decoded.sub }
  } catch {
    return null
  }
}

/**
 * Register JWT plugin with Fastify.
 */
export async function registerJwt(app: FastifyInstance, secret: string): Promise<void> {
  await app.register(import('@fastify/jwt'), {
    secret,
    sign: { algorithm: 'HS256' },
  })
}
