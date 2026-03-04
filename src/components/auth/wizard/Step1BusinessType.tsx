import { Building2, Crown, Scissors, Sparkles, Store } from 'lucide-react'
import {
  BUSINESS_TYPE_OPTIONS,
  type BusinessType,
  type BusinessTypeOption,
} from './useWizardState'

interface Step1BusinessTypeProps {
  value: BusinessType
  error?: string
  onSelect: (value: Exclude<BusinessType, null>) => void
}

function resolveIcon(option: BusinessTypeOption) {
  if (option.value === 'traditional') return Store
  if (option.value === 'modern') return Sparkles
  if (option.value === 'studio') return Scissors
  if (option.value === 'premium') return Crown
  return Building2
}

export function Step1BusinessType({ value, error, onSelect }: Step1BusinessTypeProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {BUSINESS_TYPE_OPTIONS.map((option) => {
          const Icon = resolveIcon(option)
          const isSelected = value === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={`group rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-[#ef4444] bg-[color-mix(in_srgb,#ef4444_14%,#0f172a)] shadow-[0_0_0_1px_rgba(239,68,68,0.2),0_12px_28px_rgba(239,68,68,0.14)]'
                  : 'border-[rgba(148,163,184,0.24)] bg-[rgba(15,23,42,0.84)] hover:border-[rgba(59,130,246,0.6)] hover:bg-[rgba(30,41,59,0.9)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
                    isSelected
                      ? 'border-[rgba(239,68,68,0.55)] bg-[rgba(239,68,68,0.16)] text-[#fecaca]'
                      : 'border-[rgba(148,163,184,0.34)] bg-[rgba(15,23,42,0.88)] text-[#93c5fd] group-hover:border-[rgba(59,130,246,0.55)]'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[#f8fafc]">{option.title}</p>
                  <p className="text-xs leading-5 text-[#94a3b8]">{option.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-[rgba(248,113,113,0.3)] bg-[rgba(127,29,29,0.35)] px-3 py-2 text-xs text-[#fecaca]">
          {error}
        </p>
      )}
    </div>
  )
}
