import { forwardRef, type InputHTMLAttributes } from 'react'
import { OutlinedField } from '../ui/OutlinedField'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  helperText?: string
  containerClassName?: string
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, className, containerClassName, ...props }, _ref) => {
    return (
      <OutlinedField
        as="input"
        label={label}
        error={error}
        helperText={helperText}
        className={className}
        containerClassName={containerClassName}
        {...props}
      />
    )
  }
)

FormField.displayName = 'FormField'
