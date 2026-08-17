import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { login as apiLogin, logout as apiLogout, refreshToken as apiRefresh } from '../api/auth'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to refresh the token
        await apiRefresh()
        // Get current user
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        })
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        }
      } catch {
        // Not authenticated
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!user) return

    const refreshInterval = setInterval(
      async () => {
        try {
          await apiRefresh()
        } catch {
          // Refresh failed, logout
          setUser(null)
        }
      },
      14 * 60 * 1000,
    ) // Refresh every 14 minutes (token expires in 15)

    return () => clearInterval(refreshInterval)
  }, [user])

  const login = async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    setUser(result.user)
  }

  const logout = async () => {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
