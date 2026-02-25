import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Calendar, CalendarCheck, LogOut, Sun, Moon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { CLIENT_AVATARS_BUCKET, getSignedAvatarUrl } from '../../lib/avatarStorage'

export function ClientLayout() {
  const { clientShop, clientProfile, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [clientAvatar, setClientAvatar] = useState<string | null>(null)

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
    navigate('/login')
  }

  const navItems = [
    { to: '/cliente', icon: Calendar, label: 'Agendar', end: true },
    { to: '/cliente/agendamentos', icon: CalendarCheck, label: 'Meus Agendamentos' },
  ]

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="mx-auto flex h-[68px] w-full max-w-3xl items-center justify-between px-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">{clientShop?.name || 'BarberAge'}</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Area do Cliente</p>
          </div>
          <div className="flex items-center gap-2">
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
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl p-2 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
        <div className="barber-pole-line" aria-hidden="true" />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-7">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
        <div className="mx-auto flex max-w-3xl">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

