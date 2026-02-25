import { forwardRef, type SelectHTMLAttributes } from 'react'
import { OutlinedField } from './OutlinedField'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className, children, ...props }, _ref) => {
    return (
      <OutlinedField
        as="select"
        label={label}
        error={error}
        helperText={helperText}
        className={className}
        {...props}
      >
        {children}
      </OutlinedField>
    )
  }
)

Select.displayName = 'Select'
