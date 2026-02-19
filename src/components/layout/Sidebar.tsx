import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  UserCog,
  Settings,
  LogOut,
  X,
  Armchair,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/appointments', icon: Calendar, label: 'Agenda' },
  { to: '/app/clients', icon: Users, label: 'Clientes' },
  { to: '/app/services', icon: Scissors, label: 'Serviços' },
  { to: '/app/professionals', icon: UserCog, label: 'Profissionais' },
  { to: '/app/settings', icon: Settings, label: 'Configurações' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { currentShop } = useAuth()

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-700 dark:bg-zinc-900 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Armchair className="h-7 w-7 text-amber-600 dark:text-amber-500" />
            <span className="text-lg font-bold text-zinc-900 dark:text-white">BarberAge</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden">
            <X size={20} />
          </button>
        </div>

        {currentShop && (
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Barbearia</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{currentShop.name}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                }`
              }
              end={item.to === '/app'}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>
    </>
  )
}
