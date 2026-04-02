import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getLastAuthLoginMode } from '../../lib/authFlow'

type AppRole = 'shop' | 'client' | null
type ShopState = 'any' | 'configured' | 'unconfigured'

interface ProtectedRouteProps {
  role: Exclude<AppRole, null>
  shopState?: ShopState
  children: ReactNode
}

function resolveAppRole(userRole: ReturnType<typeof useAuth>['userRole'], user: ReturnType<typeof useAuth>['user']): AppRole {
  if (userRole === 'client') return 'client'
  if (userRole === 'admin' || userRole === 'professional' || userRole === 'reception') return 'shop'

  const userMeta = (user?.user_metadata || {}) as Record<string, unknown>
  const metadataRole = userMeta.role
  const accountType = userMeta.account_type
  if (metadataRole === 'client' || accountType === 'client') return 'client'
  if (metadataRole === 'shop' || accountType === 'shop') return 'shop'

  const lastLoginMode = getLastAuthLoginMode()
  if (lastLoginMode === 'client') return 'client'
  if (lastLoginMode === 'shop') return 'shop'

  return null
}

function resolveShopConfigured(auth: ReturnType<typeof useAuth>) {
  return Boolean(auth.currentShop || auth.shops.length > 0)
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
    </div>
  )
}

function resolveHomePath(auth: ReturnType<typeof useAuth>) {
  if (!auth.user) return '/login'

  const appRole = resolveAppRole(auth.userRole, auth.user)
  if (appRole === 'client') return '/cliente/barbearias'
  if (appRole !== 'shop') return '/login'

  return resolveShopConfigured(auth) ? '/app/dashboard' : '/create-shop'
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.loading) return <LoadingScreen />
  if (!auth.user) return <>{children}</>

  const destination = resolveHomePath(auth)
  if (destination === '/login') {
    if (location.pathname === '/login') return <>{children}</>
    return <Navigate to="/login" replace />
  }
  return <Navigate to={destination} replace />
}

export function RootRedirect() {
  const auth = useAuth()

  if (auth.loading) return <LoadingScreen />
  return <Navigate to={resolveHomePath(auth)} replace />
}

export function ProtectedRoute({ role, shopState = 'any', children }: ProtectedRouteProps) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.loading) return <LoadingScreen />
  if (!auth.user) return <Navigate to="/login" replace />

  const appRole = resolveAppRole(auth.userRole, auth.user)
  const hasConfiguredShop = resolveShopConfigured(auth)

  if (role === 'client') {
    if (appRole === 'shop') {
      return <Navigate to={hasConfiguredShop ? '/app/dashboard' : '/create-shop'} replace />
    }
    if (appRole !== 'client') return <Navigate to="/login" replace />
  }

  if (role === 'shop') {
    if (appRole === 'client') return <Navigate to="/cliente/barbearias" replace />
    if (appRole !== 'shop') return <Navigate to="/login" replace />
  }

  if (role === 'shop') {
    if (shopState === 'configured' && !hasConfiguredShop) return <Navigate to="/create-shop" replace />
    if (shopState === 'unconfigured' && hasConfiguredShop) return <Navigate to="/app/dashboard" replace />

    if (!hasConfiguredShop && location.pathname.startsWith('/app/') && location.pathname !== '/app/dashboard') {
      return <Navigate to="/create-shop" replace />
    }
  }

  return <>{children}</>
}
