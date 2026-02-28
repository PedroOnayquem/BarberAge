import type { ReactNode } from 'react'

interface AuthCardProps {
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthCard({ icon, title, subtitle, children }: AuthCardProps) {
  return (
    <main className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-8 shadow-[var(--shadow-card)] sm:px-8">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text)]">
          {icon}
        </div>
        <h1 className="text-[26px] font-semibold uppercase tracking-[0.34em] text-[var(--color-text)] sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{subtitle}</p>
      </header>
      {children}
    </main>
  )
}
