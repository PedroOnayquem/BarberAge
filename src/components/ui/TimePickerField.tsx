import { Clock3 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface TimePickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  helperText?: string
  disabled?: boolean
  stepMinutes?: number
  columns?: 3 | 4
  title?: string
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildTimes(stepMinutes: number): string[] {
  const out: string[] = []
  for (let minute = 0; minute < 24 * 60; minute += stepMinutes) {
    out.push(toTime(minute))
  }
  return out
}

export function TimePickerField({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled,
  stepMinutes = 15,
  columns = 4,
  title = 'Selecionar horário',
}: TimePickerFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const base = buildTimes(stepMinutes)
    if (!value || base.includes(value)) return base
    const merged = [...base, value]
    return merged.sort((a, b) => toMinutes(a) - toMinutes(b))
  }, [stepMinutes, value])

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
      <div ref={containerRef} className="relative outlined-field">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] px-3.5 pb-2 pt-5 text-left text-sm text-[var(--color-text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25 disabled:cursor-not-allowed disabled:opacity-60 ${
            error ? 'border-red-500' : ''
          }`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
        >
          <span className={value ? '' : 'text-transparent'}>{value || label}</span>
        </button>

        <label className="outlined-field-label pointer-events-none absolute left-3 top-0 -translate-y-1/2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {label}
        </label>

        <span className="floating-native-icon" aria-hidden="true">
          <Clock3 size={16} />
        </span>

        {open && (
          <div className="barber-timepicker-popover" role="dialog" aria-label={`${label} horário`}>
            <div className="barber-timepicker">
              <p className="barber-timepicker-title">{title}</p>
              <div
                className="barber-timepicker-grid"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {options.map((time) => {
                  const selected = value === time
                  return (
                    <button
                      key={time}
                      type="button"
                      className={`barber-timepicker-slot ${selected ? 'is-selected' : ''}`}
                      onClick={() => {
                        onChange(time)
                        setOpen(false)
                      }}
                    >
                      {time}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {helperText && !error && <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
