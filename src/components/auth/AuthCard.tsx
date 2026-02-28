import type { ReactNode } from 'react'

interface AuthCardProps {
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthCard({ icon, title, subtitle, children }: AuthCardProps) {
  return (
    <main className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-8">
      <header className="mb-6 text-center sm:mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text)] sm:h-16 sm:w-16">
          {icon}
        </div>
        <h1 className="text-[22px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text)] sm:text-[30px] sm:tracking-[0.34em]">
          {title}
        </h1>
        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] sm:mt-3 sm:text-xs sm:tracking-[0.16em]">{subtitle}</p>
      </header>
      {children}
    </main>
  )
}
