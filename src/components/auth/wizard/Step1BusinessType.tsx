import { Car, Check, Hand, HeartPulse, PawPrint, Scissors, Sparkles } from 'lucide-react'
import {
  BUSINESS_TYPE_OPTIONS,
  type BusinessCategory,
  type BusinessTypeOption,
} from './useWizardState'

interface Step1BusinessTypeProps {
  value: BusinessCategory[]
  error?: string
  onToggle: (value: BusinessCategory) => void
}

function resolveIcon(option: BusinessTypeOption) {
  if (option.value === 'barbershop') return Scissors
  if (option.value === 'manicure') return Hand
  if (option.value === 'car_wash') return Car
  if (option.value === 'aesthetics') return Sparkles
  if (option.value === 'massage') return HeartPulse
  return PawPrint
}

export function Step1BusinessType({ value, error, onToggle }: Step1BusinessTypeProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Escolha uma ou mais categorias para sua empresa aparecer nos filtros do marketplace.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {BUSINESS_TYPE_OPTIONS.map((option) => {
          const Icon = resolveIcon(option)
          const isSelected = value.includes(option.value)

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              aria-pressed={isSelected}
              className={`group rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'brand-gradient-soft border-[var(--color-accent)]/45 shadow-[0_14px_34px_rgba(123,97,255,0.18)]'
                  : 'border-[var(--color-border)] bg-white/[0.055] hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
                    isSelected
                      ? 'border-white/20 bg-white/14 text-white'
                      : 'border-white/10 bg-white/[0.06] text-[var(--color-accent)] group-hover:border-[var(--color-accent)]/40'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                    {option.title}
                    {isSelected && <Check size={15} className="text-[var(--color-accent)]" />}
                  </p>
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">{option.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="rounded-2xl border border-[#ff4d9d]/35 bg-[#ff4d9d]/10 px-3 py-2 text-xs text-red-100">
          {error}
        </p>
      )}
    </div>
  )
}
