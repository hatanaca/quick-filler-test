import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginPage } from './pages/LoginPage'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // refetch ao voltar à aba sobrescreveria caracteres digitados em inputs
      // controlados pelo cache (inputs controlados por transcricao.value)
      refetchOnWindowFocus: false,
    },
  },
})

function AppWithAuth() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? <App /> : <LoginPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
