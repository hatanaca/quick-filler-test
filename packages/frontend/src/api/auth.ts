const BASE_URL = import.meta.env.VITE_API_URL ?? ''

interface LoginResponse {
  accessToken: string
  user: {
    id: string
    email: string
    role: 'admin' | 'user'
  }
}

interface RefreshResponse {
  accessToken: string
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.erro || 'Falha no login')
  }

  const data = await response.json()

  // Store access token in memory (not localStorage for security)
  // The refresh token is stored as httpOnly cookie
  sessionStorage.setItem('accessToken', data.accessToken)

  return data
}

/**
 * Logout - revoke refresh token
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } finally {
    sessionStorage.removeItem('accessToken')
  }
}

/**
 * Refresh access token using refresh token (httpOnly cookie)
 */
export async function refreshToken(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // Include refresh token cookie
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  const data: RefreshResponse = await response.json()
  sessionStorage.setItem('accessToken', data.accessToken)

  return data.accessToken
}

/**
 * Get current access token from session storage
 */
export function getAccessToken(): string | null {
  return sessionStorage.getItem('accessToken')
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken()

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })

  // If 401, try to refresh token
  if (response.status === 401) {
    try {
      await refreshToken()
      const newToken = getAccessToken()
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
        return fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        })
      }
    } catch {
      // Refresh failed, logout
      await logout()
      throw new Error('Sessão expirada. Faça login novamente.')
    }
  }

  return response
}
