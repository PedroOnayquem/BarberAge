import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const variants = {
  primary:
    'brand-gradient-bg text-white shadow-[0_14px_32px_rgba(123,97,255,0.28)] hover:shadow-[0_18px_42px_rgba(0,194,255,0.22)] hover:brightness-110',
  secondary:
    'border border-[var(--color-border)] bg-white/[0.055] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.09]',
  danger:
    'bg-[#ff4d9d] text-white shadow-[0_14px_32px_rgba(255,77,157,0.22)] hover:bg-[#ff6bad]',
  ghost:
    'bg-transparent text-[var(--color-text)] hover:bg-white/[0.07]',
}

const sizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/35 focus:ring-offset-2 focus:ring-offset-[var(--color-bg)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
