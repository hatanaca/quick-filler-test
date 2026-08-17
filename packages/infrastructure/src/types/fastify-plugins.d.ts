import '@fastify/cookie'
import '@fastify/jwt'
import type { JWTPayload } from '../web/middleware/auth.js'

declare module 'fastify' {
  interface FastifyRequest {
    cookies: { [key: string]: string | undefined }
    user: JWTPayload
  }
  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: {
        path?: string
        httpOnly?: boolean
        secure?: boolean
        sameSite?: 'strict' | 'lax' | 'none' | boolean
        maxAge?: number
        domain?: string
        expires?: Date
      },
    ): FastifyReply
    clearCookie(name: string, options?: { path?: string; domain?: string }): FastifyReply
  }
}
