import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-7 shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  )
}
