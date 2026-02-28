import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-[#08152f]/55 dark:bg-black/60" onClick={onClose} />
      <div className={`relative w-full ${sizeClasses[size]} max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_20px_55px_rgba(10,31,68,0.2)] sm:max-h-[90vh] sm:p-6`}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
          <h2 className="text-lg font-bold text-[var(--color-text)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
