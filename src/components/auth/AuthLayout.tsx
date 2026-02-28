import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-bg)] px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.08),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[rgba(177,18,38,0.09)] to-transparent dark:from-[rgba(239,68,68,0.14)]" />
      <div className="relative z-10 w-full max-w-[560px]">{children}</div>
    </div>
  )
}
