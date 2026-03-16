import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { CalendarCheck, Home, LogOut, Moon, Search, Sun, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { CLIENT_AVATARS_BUCKET, getSignedAvatarUrl } from '../../lib/avatarStorage'

function getRouteMeta(pathname: string) {
  if (pathname.startsWith('/cliente/buscar')) {
    return { title: 'Buscar', subtitle: 'Encontre por serviço ou barbearia' }
  }
  if (pathname.startsWith('/cliente/agendamentos')) {
    return { title: 'Meus Agendamentos', subtitle: 'Acompanhe suas reservas' }
  }
  if (pathname.startsWith('/cliente/perfil')) {
    return { title: 'Perfil', subtitle: 'Seus dados e preferências' }
  }
  if (pathname.startsWith('/cliente/barbearias')) {
    return { title: 'BarberAge', subtitle: 'Explorar barbearias' }
  }
  return { title: 'BarberAge', subtitle: 'Área do cliente' }
}

export function ClientMobileLayout() {
  const { clientProfile, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [clientAvatar, setClientAvatar] = useState<string | null>(null)

  const routeMeta = useMemo(() => getRouteMeta(location.pathname), [location.pathname])

  useEffect(() => {
    let mounted = true

    async function loadAvatar() {
      const signed = await getSignedAvatarUrl(CLIENT_AVATARS_BUCKET, clientProfile?.avatar_url)
      if (mounted) setClientAvatar(signed)
    }

    loadAvatar()
    return () => {
      mounted = false
    }
  }, [clientProfile?.avatar_url])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/register')
  }

  const mobileNavItems = [
    { to: '/cliente/barbearias', icon: Home, label: 'Início' },
    { to: '/cliente/buscar', icon: Search, label: 'Buscar' },
    { to: '/cliente/agendamentos', icon: CalendarCheck, label: 'Agendamentos' },
    { to: '/cliente/perfil', icon: UserRound, label: 'Perfil' },
  ]

  const desktopNavItems = [
    { to: '/cliente/barbearias', icon: Home, label: 'Barbearias' },
    { to: '/cliente/buscar', icon: Search, label: 'Buscar' },
    { to: '/cliente/agendamentos', icon: CalendarCheck, label: 'Meus Agendamentos' },
    { to: '/cliente/perfil', icon: UserRound, label: 'Perfil' },
  ]

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="mx-auto flex h-[70px] w-full max-w-6xl items-center justify-between px-4 sm:px-5 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-[var(--color-text)] md:text-lg">
              {routeMeta.title}
            </h1>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              {routeMeta.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {clientAvatar ? (
              <img
                src={clientAvatar}
                alt="Foto do cliente"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-text)] text-xs font-bold text-[var(--color-bg-elevated)]">
                {(clientProfile?.name || user?.email || 'C').charAt(0).toUpperCase()}
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="rounded-xl p-2 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl p-2 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className="barber-pole-line" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-0 pb-24 pt-0 md:px-6 md:py-7 md:pb-7">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-4 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
                }`
              }
            >
              <item.icon size={19} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <nav className="hidden border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)] md:sticky md:bottom-0 md:block">
        <div className="mx-auto flex max-w-6xl px-2">
          {desktopNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
