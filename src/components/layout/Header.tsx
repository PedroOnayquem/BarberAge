import { useEffect, useState } from 'react'
import { Menu, Moon, Sun } from 'lucide-react'
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
    <header className="relative border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/88 backdrop-blur-xl">
      <div className="mx-auto relative flex h-[72px] items-center justify-end px-4 lg:px-6">
        <button
          onClick={onMenuClick}
          className="absolute left-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-2 text-[var(--color-text)] transition-colors hover:bg-white/[0.09] lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-2 text-[var(--color-text)] transition-colors hover:bg-white/[0.09]"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-2.5 py-1.5 shadow-[var(--shadow-card)]">
            {shopAvatar ? (
              <img
                src={shopAvatar}
                alt="Logo da empresa"
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="brand-gradient-bg flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">
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

