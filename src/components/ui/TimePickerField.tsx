import { Clock3 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePickerPopover } from './usePickerPopover'

interface TimePickerFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options?: string[]
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
  options: customOptions,
  error,
  helperText,
  disabled,
  stepMinutes = 15,
  columns = 4,
  title = 'Selecionar horário',
}: TimePickerFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const { popoverRef, popoverStyle } = usePickerPopover({
    open,
    onClose: () => setOpen(false),
    containerRef,
    triggerRef,
    minDesktopWidth: 280,
    maxWidth: 360,
    estimatedHeight: 320,
  })

  const options = useMemo(() => {
    const base = customOptions && customOptions.length > 0 ? customOptions : buildTimes(stepMinutes)
    if (!value || base.includes(value)) return base
    const merged = [...base, value]
    return merged.sort((a, b) => toMinutes(a) - toMinutes(b))
  }, [customOptions, stepMinutes, value])

  useEffect(() => {
    if (!open) return
    const selectedIndex = options.findIndex((time) => time === value)
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }, [open, options, value])

  return (
    <div className="space-y-1.5">
      <div ref={containerRef} className="relative outlined-field">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
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
          <span className={value ? '' : 'text-transparent'}>{value || label}</span>
        </button>

        <label className="outlined-field-label pointer-events-none absolute left-3 top-0 -translate-y-1/2 px-2 text-xs font-semibold text-[var(--color-text-muted)]">
          {label}
        </label>

        <span className="floating-native-icon" aria-hidden="true">
          <Clock3 size={16} />
        </span>

        {open &&
          createPortal(
            <div
              ref={popoverRef}
              className="barber-timepicker-popover"
              style={popoverStyle}
              role="dialog"
              aria-label={`${label} horário`}
            >
              <div className="barber-timepicker">
                <p className="barber-timepicker-title">{title}</p>
                <div
                  className="barber-timepicker-grid"
                  style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  onKeyDown={(event) => {
                    if (!options.length) return
                    let nextIndex = highlightedIndex >= 0 ? highlightedIndex : 0

                    if (event.key === 'ArrowRight') {
                      event.preventDefault()
                      nextIndex = Math.min(options.length - 1, nextIndex + 1)
                    } else if (event.key === 'ArrowLeft') {
                      event.preventDefault()
                      nextIndex = Math.max(0, nextIndex - 1)
                    } else if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      nextIndex = Math.min(options.length - 1, nextIndex + columns)
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      nextIndex = Math.max(0, nextIndex - columns)
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      const selected = options[nextIndex]
                      if (selected) {
                        onChange(selected)
                        setOpen(false)
                      }
                      return
                    }

                    setHighlightedIndex(nextIndex)
                  }}
                >
                  {options.map((time) => {
                    const selected = value === time
                    const highlighted = highlightedIndex >= 0 && options[highlightedIndex] === time
                    return (
                      <button
                        key={time}
                        type="button"
                        className={`barber-timepicker-slot ${selected ? 'is-selected' : ''} ${highlighted ? 'is-highlighted' : ''}`}
                        onClick={() => {
                          onChange(time)
                          setOpen(false)
                        }}
                        onMouseEnter={() => setHighlightedIndex(options.indexOf(time))}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>

      {helperText && !error && <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
