import type { ReactNode } from 'react'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  children: ReactNode
}

const variants = {
  default: 'border border-[var(--color-border)] bg-white/[0.055] text-[var(--color-text)]',
  success: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-200',
  warning: 'border border-amber-500/35 bg-amber-500/15 text-amber-200',
  danger: 'border border-[#ff4d9d]/45 bg-[#ff4d9d]/15 text-red-100',
  info: 'border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] text-[var(--color-text)]',
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  )
}
