import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AppLayout } from './components/layout/AppLayout'
import { ClientMobileLayout } from './components/layout/ClientMobileLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterClientPage } from './pages/auth/RegisterClientPage'
import { CreateShopPage } from './pages/auth/CreateShopPage'
import { DashboardPage } from './pages/DashboardPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { ClientsPage } from './pages/ClientsPage'
import { ServicesPage } from './pages/ServicesPage'
import { ProfessionalsPage } from './pages/ProfessionalsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ClientBookingPage } from './pages/cliente/ClientBookingPage'
import { ClientAppointmentsPage } from './pages/cliente/ClientAppointmentsPage'
import { BarbershopsPage } from './pages/public/BarbershopsPage'
import { BarbershopPublicPage } from './pages/public/BarbershopPublicPage'
import { ClientBarbershopsPage } from './pages/cliente/ClientBarbershopsPage'
import { ClientBarbershopBookingPage } from './pages/cliente/ClientBarbershopBookingPage'
import { ClientSearchPage } from './pages/cliente/ClientSearchPage'
import { ClientProfilePage } from './pages/cliente/ClientProfilePage'
import { type ReactNode } from 'react'

function resolveAuthenticatedDestination(params: {
  user: ReturnType<typeof useAuth>['user']
  currentShop: ReturnType<typeof useAuth>['currentShop']
  userRole: ReturnType<typeof useAuth>['userRole']
}) {
  if (!params.user) return null
  if (params.currentShop) return '/app/dashboard'
  if (params.userRole === 'client') return '/cliente/barbearias'
  return '/create-shop'
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
    </div>
  )
}

function ShopProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, currentShop } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/register" replace />
  if (!currentShop) return <Navigate to="/create-shop" replace />

  return <>{children}</>
}

function ClientProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, userRole } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/register" replace />
  if (userRole !== 'client') return <Navigate to="/cliente/register" replace />

  return <>{children}</>
}

function PublicRoute({
  children,
  allowAuthenticated = false,
}: {
  children: ReactNode
  allowAuthenticated?: boolean
}) {
  const { loading, user, currentShop, userRole } = useAuth()

  if (loading) return <LoadingScreen />
  if (!allowAuthenticated) {
    const redirectTo = resolveAuthenticatedDestination({ user, currentShop, userRole })
    if (redirectTo) return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

function CreateShopRoute({ children }: { children: ReactNode }) {
  const { user, loading, currentShop, userRole } = useAuth()

  if (loading) return <LoadingScreen />
  if (userRole === 'client') return <Navigate to="/cliente/barbearias" replace />
  if (user && currentShop) return <Navigate to="/app/dashboard" replace />

  return <>{children}</>
}

function AppRoutes() {
  const createShopElement = (
    <CreateShopRoute>
      <CreateShopPage />
    </CreateShopRoute>
  )

  return (
    <Routes>
      {/* Root route */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public marketplace routes */}
      <Route path="/barbearias" element={<BarbershopsPage />} />
      <Route path="/barbearias/:slug" element={<BarbershopPublicPage />} />

      {/* Public routes */}
      <Route path="/login" element={<Navigate to="/register" replace />} />
      <Route path="/register" element={<PublicRoute allowAuthenticated><LoginPage /></PublicRoute>} />
      <Route path="/cliente/register" element={<PublicRoute><RegisterClientPage /></PublicRoute>} />
      <Route path="/create-shop" element={createShopElement} />

      {/* Shop admin routes (/app/*) */}
      <Route path="/app" element={<ShopProtectedRoute><AppLayout /></ShopProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="professionals" element={<ProfessionalsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Client routes (/cliente/*) */}
      <Route path="/cliente" element={<ClientProtectedRoute><ClientMobileLayout /></ClientProtectedRoute>}>
        <Route index element={<Navigate to="/cliente/barbearias" replace />} />
        <Route path="barbearias" element={<ClientBarbershopsPage />} />
        <Route path="buscar" element={<ClientSearchPage />} />
        <Route path="barbearias/:slug" element={<ClientBarbershopBookingPage />} />
        <Route path="agendar" element={<ClientBookingPage />} />
        <Route path="agendamentos" element={<ClientAppointmentsPage />} />
        <Route path="perfil" element={<ClientProfilePage />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

function RootRedirect() {
  return <Navigate to="/register" replace />
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
