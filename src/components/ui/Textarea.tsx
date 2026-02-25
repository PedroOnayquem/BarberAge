import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { OutlinedField } from './OutlinedField'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, ...props }, _ref) => {
    return (
      <OutlinedField
        as="textarea"
        label={label}
        error={error}
        helperText={helperText}
        className={className}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'
