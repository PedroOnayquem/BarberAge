import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone } from '../../../lib/phone'

interface ProfileFormProps {
  name: string
  phone: string
  email: string
  loading: boolean
  success: boolean
  error?: string
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
}

export function ProfileForm({
  name,
  phone,
  email,
  loading,
  success,
  error,
  onNameChange,
  onPhoneChange,
  onSubmit,
}: ProfileFormProps) {
  function handlePhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = event.target.value
    const currentCaret = event.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, currentCaret)
    const formattedValue = formatPhone(rawValue)
    const nextCaret = caretIndexFromDigitCount(formattedValue, digitsBeforeCaret)

    onPhoneChange(formattedValue)

    requestAnimationFrame(() => {
      event.target.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Dados pessoais</h2>

      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        {error && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-primary)]">
            {error}
          </div>
        )}

        <Input label="Nome" value={name} onChange={(e) => onNameChange(e.target.value)} required />
        <Input
          label="Telefone"
          value={phone}
          onChange={handlePhoneChange}
          inputMode="numeric"
          autoComplete="tel"
          maxLength={15}
        />
        <Input label="Email" value={email} disabled />

        <div className="flex items-center gap-3">
          <Button type="submit" loading={loading}>
            Editar perfil
          </Button>
          {success && <span className="text-sm text-[var(--color-text)]">Salvo com sucesso!</span>}
        </div>
      </form>
    </section>
  )
}
