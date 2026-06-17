import { CalendarDays } from 'lucide-react'
import { format, parseISO, startOfDay } from 'date-fns'
import { ptBR, type Locale } from 'date-fns/locale'
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DatePickerCard } from './DatePickerCard'
import { usePickerPopover } from './usePickerPopover'

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
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const parsed = useMemo(() => parseValue(value), [value])
  const selectedDate = parsed ?? startOfDay(new Date())
  const displayValue = parsed ? format(parsed, 'dd/MM/yyyy', { locale }) : ''
  const { popoverRef, popoverStyle } = usePickerPopover({
    open,
    onClose: () => setOpen(false),
    containerRef,
    triggerRef,
    minDesktopWidth: 320,
    maxWidth: 340,
    estimatedHeight: 380,
  })

  return (
    <div className="space-y-1.5">
      <div ref={containerRef} className="relative outlined-field">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((prev) => !prev)
          }}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={`w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 pb-2 pt-5 text-left text-sm text-[var(--color-text)] transition-all focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 disabled:cursor-not-allowed disabled:opacity-60 ${
            error ? 'border-red-500' : ''
          }`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
        >
          <span className={displayValue ? '' : 'text-transparent'}>{displayValue || label}</span>
        </button>

        <label className="outlined-field-label pointer-events-none absolute left-3 top-0 -translate-y-1/2 px-2 text-xs font-semibold text-[var(--color-text-muted)]">
          {label}
        </label>

        <span className="floating-native-icon" aria-hidden="true">
          <CalendarDays size={16} />
        </span>

        {open &&
          createPortal(
            <div
              ref={popoverRef}
              className="barber-datepicker-popover"
              style={popoverStyle}
              role="dialog"
              aria-label={`${label} calendário`}
            >
              <DatePickerCard
                value={selectedDate}
                onChange={(next) => {
                  onChange(format(next, 'yyyy-MM-dd'))
                  setOpen(false)
                }}
                minDate={minDate}
                locale={locale}
              />
            </div>,
            document.body
          )}
      </div>

      {helperText && !error && <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
