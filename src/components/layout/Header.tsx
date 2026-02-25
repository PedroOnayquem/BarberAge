import { useEffect, useState } from 'react'
import { Menu, Moon, Sun, Sparkles } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { user, currentShop } = useAuth()
  const [shopAvatar, setShopAvatar] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadAvatar() {
      const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, currentShop?.avatar_url)
      if (mounted) setShopAvatar(signed)
    }

    loadAvatar()
    return () => {
      mounted = false
    }
  }, [currentShop?.avatar_url])

  return (
    <header className="relative border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <div className="mx-auto flex h-[72px] items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-xl p-2 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-text)] text-[var(--color-bg-elevated)] shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">BarberAge</p>
              <p className="text-sm font-bold text-[var(--color-text)]">Painel Premium</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 shadow-sm">
            {shopAvatar ? (
              <img
                src={shopAvatar}
                alt="Logo da barbearia"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span className="hidden max-w-48 truncate text-sm font-semibold text-[var(--color-text)] sm:block">
              {user?.email}
            </span>
          </div>
        </div>
      </div>
      <div className="barber-pole-line" aria-hidden="true" />
    </header>
  )
}

