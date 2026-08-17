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

interface StoredUser {
  id: string
  email: string
  passwordHash: string
  role: 'admin' | 'user'
}

const USERS = new Map<string, StoredUser>()

function seedUsers(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const userEmail = process.env.USER_EMAIL
  const userPassword = process.env.USER_PASSWORD

  if (adminEmail && adminPassword) {
    USERS.set(adminEmail, {
      id: 'usr_admin_001',
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: 'admin',
    })
  }

  if (userEmail && userPassword) {
    USERS.set(userEmail, {
      id: 'usr_user_001',
      email: userEmail,
      passwordHash: hashPassword(userPassword),
      role: 'user',
    })
  }

  if (USERS.size === 0 && nodeEnv !== 'production') {
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
  }
}

seedUsers()

// Map of refresh tokens to their creation timestamp
const REFRESH_TOKENS = new Map<string, number>()
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// Periodic cleanup of expired tokens to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [token, createdAt] of REFRESH_TOKENS) {
    if (now - createdAt > TOKEN_MAX_AGE_MS) {
      REFRESH_TOKENS.delete(token)
    }
  }
}, CLEANUP_INTERVAL_MS)

function setRefreshCookie(reply: FastifyReply, token: string, request: FastifyRequest): void {
  // Trust only request.protocol (set by Fastify based on trustProxy config)
  // to prevent X-Forwarded-Proto spoofing when trustProxy is misconfigured
  const isSecure = process.env.NODE_ENV === 'production' || request.protocol === 'https'
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

      REFRESH_TOKENS.set(refreshToken, Date.now())
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
    // Only accept refresh token from httpOnly cookie — never from request body.
    // Accepting from body would bypass httpOnly protection and allow XSS exfiltration.
    const refreshToken = request.cookies?.refreshToken

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
    REFRESH_TOKENS.set(newTokens.refreshToken, Date.now())
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
