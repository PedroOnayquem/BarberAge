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
      {open && <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={onClose} />}
      <aside
        className={`group/sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-sidebar-bg)_92%,#000)_0%,var(--color-sidebar-bg)_52%,color-mix(in_srgb,var(--color-sidebar-bg)_70%,#1e3a8a)_100%)] text-[var(--color-sidebar-text)] shadow-[0_14px_40px_rgba(2,8,20,0.45)] transition-[transform,width] duration-300 ease-out lg:static lg:w-20 lg:translate-x-0 lg:hover:w-72 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 pb-5 pt-4 lg:px-3">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 items-start gap-3 lg:w-full lg:justify-center lg:group-hover/sidebar:justify-start">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
                <Armchair className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-1 overflow-hidden">
                <span className="block max-w-[11rem] whitespace-nowrap text-lg font-bold text-white transition-[max-width,opacity,transform] duration-300 ease-out lg:max-w-0 lg:-translate-x-1 lg:opacity-0 lg:group-hover/sidebar:max-w-[11rem] lg:group-hover/sidebar:translate-x-0 lg:group-hover/sidebar:opacity-100">
                  BarberAge
                </span>
                <span className="inline-flex max-w-[8rem] items-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-[max-width,opacity,transform] duration-300 ease-out lg:max-w-0 lg:-translate-x-1 lg:opacity-0 lg:group-hover/sidebar:max-w-[8rem] lg:group-hover/sidebar:translate-x-0 lg:group-hover/sidebar:opacity-100">
                  Premium
                </span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-1 text-white/70 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fechar menu">
              <X size={20} />
            </button>
          </div>

          {currentShop && (
            <div className="mt-4 overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out lg:max-h-0 lg:px-1 lg:py-0 lg:opacity-0 lg:group-hover/sidebar:max-h-24 lg:group-hover/sidebar:px-1 lg:group-hover/sidebar:py-0 lg:group-hover/sidebar:opacity-100">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">Barbearia</p>
              <p className="mt-1 truncate text-sm font-semibold text-white/95">{currentShop.name}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-2.5 overflow-y-auto px-3 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              title={item.label}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 lg:justify-center lg:px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-3 ${
                  isActive
                    ? 'bg-white/12 text-white shadow-[0_10px_22px_rgba(0,0,0,0.26),0_0_0_1px_rgba(255,255,255,0.08)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-full before:bg-[var(--color-primary)]'
                    : 'text-white/76 hover:bg-white/8 hover:text-white'
                }`
              }
              end={item.to === '/app'}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={19} className={`shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-65 group-hover:opacity-90'}`} />
                  <span className="max-w-[10rem] overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out lg:max-w-0 lg:-translate-x-1 lg:opacity-0 lg:group-hover/sidebar:max-w-[10rem] lg:group-hover/sidebar:translate-x-0 lg:group-hover/sidebar:opacity-100">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 pb-4">
          <button
            onClick={handleLogout}
            title="Sair"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white/90 lg:justify-center lg:px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-3"
          >
            <LogOut size={18} className="shrink-0 opacity-75" />
            <span className="max-w-[10rem] overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out lg:max-w-0 lg:-translate-x-1 lg:opacity-0 lg:group-hover/sidebar:max-w-[10rem] lg:group-hover/sidebar:translate-x-0 lg:group-hover/sidebar:opacity-100">
              Sair
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}

