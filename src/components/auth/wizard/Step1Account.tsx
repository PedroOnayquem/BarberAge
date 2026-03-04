import { ShieldCheck } from 'lucide-react'
import { Input } from '../../ui/Input'
import type { WizardData, WizardErrors } from './useWizardState'

type SetWizardField = <K extends keyof WizardData>(field: K, value: WizardData[K]) => void

interface Step1AccountProps {
  data: WizardData
  errors: WizardErrors
  isAuthenticated: boolean
  currentEmail: string
  accountLoading: boolean
  onUseDifferentAccount: () => void
  onFieldChange: SetWizardField
}

export function Step1Account({
  data,
  errors,
  isAuthenticated,
  currentEmail,
  accountLoading,
  onUseDifferentAccount,
  onFieldChange,
}: Step1AccountProps) {
  if (isAuthenticated) {
    return (
      <section className="rounded-2xl border border-[rgba(74,222,128,0.35)] bg-[rgba(20,83,45,0.28)] p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(74,222,128,0.38)] bg-[rgba(21,128,61,0.3)] text-[#bbf7d0]">
            <ShieldCheck size={18} />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#f0fdf4]">Conta autenticada</p>
            <p className="text-xs text-[#bbf7d0]">
              Voce ja esta logado como <strong>{currentEmail || 'usuario autenticado'}</strong>. Clique em
              continuar para prosseguir com o cadastro da barbearia.
            </p>
            <button
              type="button"
              onClick={onUseDifferentAccount}
              disabled={accountLoading}
              className="mt-2 rounded-lg border border-[rgba(191,219,254,0.45)] bg-[rgba(15,23,42,0.42)] px-3 py-1.5 text-xs font-semibold text-[#dbeafe] transition hover:bg-[rgba(30,41,59,0.75)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accountLoading ? 'Saindo...' : 'Usar outro email'}
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={data.accountEmail}
        onChange={(event) => onFieldChange('accountEmail', event.target.value)}
        error={errors.accountEmail}
        autoComplete="email"
      />

      <Input
        label="Senha"
        type="password"
        value={data.accountPassword}
        onChange={(event) => onFieldChange('accountPassword', event.target.value)}
        error={errors.accountPassword}
        autoComplete="new-password"
      />

      <Input
        label="Confirmar senha"
        type="password"
        value={data.accountConfirmPassword}
        onChange={(event) => onFieldChange('accountConfirmPassword', event.target.value)}
        error={errors.accountConfirmPassword}
        autoComplete="new-password"
      />

      <p className="text-xs text-[#94a3b8]">
        Esta etapa substitui o cadastro antigo em <code>/register</code>. Depois de criar a conta, voce segue para os dados da barbearia.
      </p>
    </div>
  )
}
