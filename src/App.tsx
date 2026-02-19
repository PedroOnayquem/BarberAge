import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AppLayout } from './components/layout/AppLayout'
import { ClientLayout } from './components/layout/ClientLayout'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
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
import type { ReactNode } from 'react'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
    </div>
  )
}

function ShopProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, currentShop } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!currentShop) return <Navigate to="/create-shop" replace />

  return <>{children}</>
}

function ClientProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, clientUser } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!clientUser) return <Navigate to="/cliente/register" replace />

  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading, currentShop, userRole } = useAuth()

  if (loading) return <LoadingScreen />

  // If logged in, redirect based on role
  if (user) {
    if (userRole === 'client') return <Navigate to="/cliente" replace />
    if (currentShop) return <Navigate to="/app" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/cliente/register" element={<RegisterClientPage />} />
      <Route path="/create-shop" element={<CreateShopPage />} />

      {/* Shop admin routes (/app/*) */}
      <Route path="/app" element={<ShopProtectedRoute><AppLayout /></ShopProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="professionals" element={<ProfessionalsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Client routes (/cliente/*) */}
      <Route path="/cliente" element={<ClientProtectedRoute><ClientLayout /></ClientProtectedRoute>}>
        <Route index element={<ClientBookingPage />} />
        <Route path="agendamentos" element={<ClientAppointmentsPage />} />
      </Route>

      {/* Default redirect */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

function RootRedirect() {
  const { user, loading, currentShop, userRole } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (userRole === 'client') return <Navigate to="/cliente" replace />
  if (currentShop) return <Navigate to="/app" replace />
  return <Navigate to="/create-shop" replace />
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
