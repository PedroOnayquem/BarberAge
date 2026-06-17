import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="app-shell relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2 brand-gradient-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(123,97,255,0.18),transparent_38%),linear-gradient(315deg,rgba(255,122,24,0.12),transparent_44%)]" />
      <div className="relative z-10 w-full max-w-[480px]">{children}</div>
    </div>
  )
}
