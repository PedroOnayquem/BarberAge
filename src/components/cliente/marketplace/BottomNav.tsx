import { CalendarCheck2, Home, Search, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'

interface BottomNavProps {
  onSearchClick: () => void
}

export function BottomNav({ onSearchClick }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-4 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2">
        <Link
          to="/cliente/barbearias"
          className="flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold text-[var(--color-primary)]"
        >
          <Home size={19} />
          Início
        </Link>

        <button
          type="button"
          onClick={onSearchClick}
          className="flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)]"
        >
          <Search size={19} />
          Buscar
        </button>

        <Link
          to="/cliente/agendamentos"
          className="flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)]"
        >
          <CalendarCheck2 size={19} />
          Agendamentos
        </Link>

        <Link
          to="/cliente/agendamentos"
          className="flex flex-col items-center gap-1 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)]"
        >
          <UserRound size={19} />
          Perfil
        </Link>
      </div>
    </nav>
  )
}

