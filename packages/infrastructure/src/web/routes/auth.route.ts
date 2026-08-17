import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { DomainError } from '@quickfiller/domain'
import {
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  type JWTPayload,
} from '../middleware/auth.js'

/**
 * Simple in-memory user store for demo purposes.
 * In production, this would be a database with hashed passwords.
 */
const USERS = new Map<
  string,
  { id: string; email: string; password: string; role: 'admin' | 'user' }
>()

// Seed demo users
USERS.set('admin@quickfiller.com', {
  id: 'usr_admin_001',
  email: 'admin@quickfiller.com',
  password: 'admin123', // In production, use bcrypt
  role: 'admin',
})
USERS.set('user@quickfiller.com', {
  id: 'usr_user_001',
  email: 'user@quickfiller.com',
  password: 'user123', // In production, use bcrypt
  role: 'user',
})

// Track refresh tokens (in production, use Redis or database)
const REFRESH_TOKENS = new Set<string>()

export function registerAuthRoutes(app: FastifyInstance): void {
  /**
   * POST /api/auth/login
   * Authenticate user and return access + refresh tokens
   */
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string; password?: string }

    if (!body?.email || !body?.password) {
      throw new DomainError('Email e senha são obrigatórios')
    }

    const user = USERS.get(body.email)
    if (!user || user.password !== body.password) {
      throw new DomainError('Credenciais inválidas')
    }

    const { accessToken, refreshToken } = generateTokens.call(app, {
      id: user.id,
      email: user.email,
      role: user.role,
    })

    // Store refresh token
    REFRESH_TOKENS.add(refreshToken)

    // Set refresh token as httpOnly cookie
    // secure: true only when using HTTPS (gateway terminates SSL)
    const isSecure =
      request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https'
    reply.setCookie('refreshToken', refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    }
  })

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    // Try to get refresh token from cookie or body
    const refreshToken =
      request.cookies?.refreshToken || (request.body as { refreshToken?: string })?.refreshToken

    if (!refreshToken) {
      return reply.status(401).send({ erro: 'Refresh token não fornecido' })
    }

    // Verify refresh token
    const payload = verifyRefreshToken.call(app, refreshToken)
    if (!payload) {
      return reply.status(401).send({ erro: 'Refresh token inválido' })
    }

    // Check if token was revoked
    if (!REFRESH_TOKENS.has(refreshToken)) {
      return reply.status(401).send({ erro: 'Refresh token revogado' })
    }

    // Find user
    const user = Array.from(USERS.values()).find((u) => u.id === payload.sub)
    if (!user) {
      return reply.status(401).send({ erro: 'Usuário não encontrado' })
    }

    // Generate new tokens
    const newTokens = generateTokens.call(app, {
      id: user.id,
      email: user.email,
      role: user.role,
    })

    // Revoke old refresh token and store new one
    REFRESH_TOKENS.delete(refreshToken)
    REFRESH_TOKENS.add(newTokens.refreshToken)

    // Set new refresh token as httpOnly cookie
    const isSecure =
      request.headers['x-forwarded-proto'] === 'https' || request.protocol === 'https'
    reply.setCookie('refreshToken', newTokens.refreshToken, {
      path: '/api/auth',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    })

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
