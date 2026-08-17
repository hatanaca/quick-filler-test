import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthenticationError, DomainError } from '@quickfiller/domain'
import {
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  type JWTPayload,
} from '../middleware/auth.js'

const SCRYPT_KEYLEN = 64

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(hash, 'hex')
  return timingSafeEqual(derived, expected)
}

const USERS = new Map<
  string,
  { id: string; email: string; passwordHash: string; role: 'admin' | 'user' }
>()

// Seed demo users with hashed passwords
USERS.set('admin@quickfiller.com', {
  id: 'usr_admin_001',
  email: 'admin@quickfiller.com',
  passwordHash: hashPassword('admin123'),
  role: 'admin',
})
USERS.set('user@quickfiller.com', {
  id: 'usr_user_001',
  email: 'user@quickfiller.com',
  passwordHash: hashPassword('user123'),
  role: 'user',
})

const REFRESH_TOKENS = new Set<string>()

function setRefreshCookie(reply: FastifyReply, token: string, request: FastifyRequest): void {
  const isSecure = request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https'
  reply.setCookie('refreshToken', token, {
    path: '/api/auth',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
}

export function registerAuthRoutes(app: FastifyInstance): void {
  /**
   * POST /api/auth/login
   * Authenticate user and return access + refresh tokens
   */
  app.post(
    '/api/auth/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { email?: string; password?: string }

      if (!body?.email || !body?.password) {
        throw new DomainError('Email e senha são obrigatórios')
      }

      const user = USERS.get(body.email)
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        throw new AuthenticationError('Credenciais inválidas')
      }

      const { accessToken, refreshToken } = generateTokens.call(app, {
        id: user.id,
        email: user.email,
        role: user.role,
      })

      REFRESH_TOKENS.add(refreshToken)
      setRefreshCookie(reply, refreshToken, request)

      return {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      }
    },
  )

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken =
      request.cookies?.refreshToken || (request.body as { refreshToken?: string })?.refreshToken

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token não fornecido')
    }

    const payload = verifyRefreshToken.call(app, refreshToken)
    if (!payload) {
      throw new AuthenticationError('Refresh token inválido')
    }

    if (!REFRESH_TOKENS.has(refreshToken)) {
      throw new AuthenticationError('Refresh token revogado')
    }

    const user = Array.from(USERS.values()).find((u) => u.id === payload.sub)
    if (!user) {
      throw new AuthenticationError('Usuário não encontrado')
    }

    const newTokens = generateTokens.call(app, {
      id: user.id,
      email: user.email,
      role: user.role,
    })

    REFRESH_TOKENS.delete(refreshToken)
    REFRESH_TOKENS.add(newTokens.refreshToken)
    setRefreshCookie(reply, newTokens.refreshToken, request)

    return {
      accessToken: newTokens.accessToken,
    }
  })

  /**
   * POST /api/auth/logout
   * Revoke refresh token
   */
  app.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies?.refreshToken

    if (refreshToken) {
      REFRESH_TOKENS.delete(refreshToken)
    }

    reply.clearCookie('refreshToken', { path: '/api/auth' })

    return { message: 'Logout realizado com sucesso' }
  })

  /**
   * GET /api/auth/me
   * Get current user info (requires authentication)
   */
  app.get('/api/auth/me', { preHandler: [verifyToken] }, async (request: FastifyRequest) => {
    const user = request.user as JWTPayload
    const userData = USERS.get(user.email)

    if (!userData) {
      throw new DomainError('Usuário não encontrado')
    }

    return {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    }
  })
}
