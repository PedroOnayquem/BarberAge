import { Menu, Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-700 dark:bg-zinc-900 lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:block">
            {user?.email}
          </span>
        </div>
      </div>
    </header>
  )
}
