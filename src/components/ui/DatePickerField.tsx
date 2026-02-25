import { CalendarDays } from 'lucide-react'
import { format, parseISO, startOfDay } from 'date-fns'
import { ptBR, type Locale } from 'date-fns/locale'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DatePickerCard } from './DatePickerCard'

interface DatePickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  minDate?: Date
  error?: string
  helperText?: string
  disabled?: boolean
  locale?: Locale
}

function parseValue(value: string): Date | null {
  if (!value) return null
  return parseISO(`${value}T00:00:00`)
}

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  error,
  helperText,
  disabled,
  locale = ptBR,
}: DatePickerFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const parsed = useMemo(() => parseValue(value), [value])
  const selectedDate = parsed ?? startOfDay(new Date())
  const displayValue = parsed ? format(parsed, 'dd/MM/yyyy', { locale }) : ''

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-1.5">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((prev) => !prev)
          }}
          className={`w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] px-3.5 pb-2 pt-5 text-left text-sm text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 disabled:cursor-not-allowed disabled:opacity-60 ${
            error ? 'border-red-500' : ''
          }`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
        >
          <span className={displayValue ? '' : 'text-transparent'}>{displayValue || label}</span>
        </button>

        <label className="outlined-field-label pointer-events-none absolute left-3 top-0 -translate-y-1/2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {label}
        </label>

        <span className="floating-native-icon" aria-hidden="true">
          <CalendarDays size={16} />
        </span>

        {open && (
          <div className="barber-datepicker-popover" role="dialog" aria-label={`${label} calendário`}>
            <DatePickerCard
              value={selectedDate}
              onChange={(next) => {
                onChange(format(next, 'yyyy-MM-dd'))
                setOpen(false)
              }}
              minDate={minDate}
              locale={locale}
            />
          </div>
        )}
      </div>

      {helperText && !error && <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
