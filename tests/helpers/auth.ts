import type { FastifyInstance } from 'fastify'

/**
 * Helper to get a test authentication token.
 * In tests, we use the dev secret to generate tokens.
 */
export async function getTestToken(app: FastifyInstance): Promise<string> {
  // Login with credentials from environment variables
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: process.env.ADMIN_EMAIL || 'admin@quickfiller.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
    },
  })

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Login failed: ${loginResponse.body}`)
  }

  const { accessToken } = loginResponse.json()
  return accessToken
}

/**
 * Helper to get auth headers for test requests.
 */
export async function getAuthHeaders(app: FastifyInstance): Promise<{ Authorization: string }> {
  const token = await getTestToken(app)
  return { Authorization: `Bearer ${token}` }
}
