import { CalendarDays, ChevronDown, Clock3, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

type FieldKind = 'input' | 'select' | 'textarea'

interface OutlinedFieldProps {
  as?: FieldKind
  id?: string
  name?: string
  label?: string
  value?: string | number | readonly string[] | undefined
  defaultValue?: string | number | readonly string[] | undefined
  onChange?: (event: any) => void
  onFocus?: (event: any) => void
  onBlur?: (event: any) => void
  type?: string
  icon?: LucideIcon
  error?: string
  helperText?: string
  disabled?: boolean
  required?: boolean
  className?: string
  containerClassName?: string
  children?: ReactNode
  rows?: number
  min?: number | string
  max?: number | string
  step?: number | string
  accept?: string
  autoComplete?: string
}

function resolveIcon(as: FieldKind, type?: string, provided?: LucideIcon): LucideIcon | null {
  if (provided) return provided
  if (as === 'select') return ChevronDown
  if (type === 'date') return CalendarDays
  if (type === 'time') return Clock3
  return null
}

export function OutlinedField({
  as = 'input',
  id,
  name,
  label,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  type = 'text',
  icon,
  error,
  helperText,
  disabled,
  required,
  className = '',
  containerClassName = '',
  children,
  rows = 4,
  min,
  max,
  step,
  accept,
  autoComplete,
}: OutlinedFieldProps) {
  const fieldId = id || label?.toLowerCase().replace(/\s+/g, '-') || undefined
  const Icon = resolveIcon(as, type, icon)
  const withIcon = Icon ? 'pr-10' : ''
  const baseField =
    'w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 disabled:cursor-not-allowed disabled:opacity-60'
  const padding = as === 'textarea' ? 'px-3.5 pb-3 pt-5' : 'px-3.5 pb-2 pt-5'
  const selectFix = as === 'select' ? 'appearance-none' : ''
  const fieldClasses = `${baseField} ${padding} ${withIcon} ${selectFix} ${error ? 'border-red-500' : ''} ${className}`

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      <div className="relative outlined-field">
        {as === 'textarea' ? (
          <textarea
            id={fieldId}
            name={name}
            value={value as string | number | readonly string[] | undefined}
            defaultValue={defaultValue as string | number | readonly string[] | undefined}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={onChange}
            disabled={disabled}
            required={required}
            rows={rows}
            className={`${fieldClasses} resize-y`}
          />
        ) : as === 'select' ? (
          <select
            id={fieldId}
            name={name}
            value={value as string | number | readonly string[] | undefined}
            defaultValue={defaultValue as string | number | readonly string[] | undefined}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className={fieldClasses}
          >
            <option value="" hidden />
            {children}
          </select>
        ) : (
          <input
            id={fieldId}
            name={name}
            type={type}
            value={value as string | number | readonly string[] | undefined}
            defaultValue={defaultValue as string | number | readonly string[] | undefined}
            onFocus={onFocus}
            onBlur={onBlur}
            onChange={onChange}
            disabled={disabled}
            required={required}
            min={min}
            max={max}
            step={step}
            accept={accept}
            autoComplete={autoComplete}
            className={fieldClasses}
          />
        )}

        {Icon && (
          <span className="floating-native-icon" aria-hidden="true">
            <Icon size={16} />
          </span>
        )}

        {label && (
          <label
            htmlFor={fieldId}
            className="outlined-field-label pointer-events-none absolute left-3 top-0 -translate-y-1/2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors duration-200"
          >
            {label}
          </label>
        )}
      </div>

      {helperText && !error && <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
