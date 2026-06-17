import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AppLayout } from './components/layout/AppLayout'
import { ClientMobileLayout } from './components/layout/ClientMobileLayout'
import { ProtectedRoute, PublicRoute, RootRedirect } from './components/routing/guards'
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
import { BarbershopsPage } from './pages/public/BarbershopsPage'
import { BarbershopPublicPage } from './pages/public/BarbershopPublicPage'
import { ClientBarbershopsPage } from './pages/cliente/ClientBarbershopsPage'
import { ClientBarbershopBookingPage } from './pages/cliente/ClientBarbershopBookingPage'
import { ClientSearchPage } from './pages/cliente/ClientSearchPage'
import { ClientProfilePage } from './pages/cliente/ClientProfilePage'

function AppRoutes() {
  return (
    <Routes>
      {/* Root route */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public marketplace routes */}
      <Route path="/empresas" element={<BarbershopsPage />} />
      <Route path="/empresas/:slug" element={<BarbershopPublicPage />} />
      <Route path="/barbearias" element={<Navigate to="/empresas" replace />} />
      <Route path="/barbearias/:slug" element={<BarbershopPublicPage />} />

      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/signup-shop" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/cliente/register" element={<PublicRoute><RegisterClientPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><RegisterClientPage /></PublicRoute>} />
      <Route path="/create-shop" element={<ProtectedRoute role="shop" shopState="unconfigured"><CreateShopPage /></ProtectedRoute>} />

      {/* Shop admin routes (/app/*) */}
      <Route path="/app" element={<ProtectedRoute role="shop"><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="professionals" element={<ProfessionalsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Client routes (/cliente/*) */}
      <Route path="/cliente" element={<ProtectedRoute role="client"><ClientMobileLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/cliente/empresas" replace />} />
        <Route path="empresas" element={<ClientBarbershopsPage />} />
        <Route path="buscar" element={<ClientSearchPage />} />
        <Route path="empresas/:slug" element={<ClientBarbershopBookingPage />} />
        <Route path="barbearias" element={<Navigate to="/cliente/empresas" replace />} />
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
