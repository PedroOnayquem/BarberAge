import type { ReactNode } from 'react'

interface AuthCardProps {
  icon?: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthCard({ icon, title, subtitle, children }: AuthCardProps) {
  return (
    <main className="glass-surface rounded-[28px] px-5 py-7 sm:px-8 sm:py-8">
      <header className="mb-7 text-center sm:mb-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] text-white shadow-[0_18px_38px_rgba(0,0,0,0.22)]">
          {icon || <img src="/apple-touch-icon.png" alt="BarberAge" className="h-9 w-9 object-contain" />}
        </div>
        <p className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">BarberAge</p>
        <h1 className="text-[30px] font-extrabold leading-tight text-[var(--color-text)] sm:text-[36px]">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-muted)]">{subtitle}</p>
      </header>
      {children}
    </main>
  )
}
