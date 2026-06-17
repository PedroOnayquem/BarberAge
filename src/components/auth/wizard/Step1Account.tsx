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
  verificationEmail?: string
  verificationMessage?: string
  pendingDraftEmail?: string
  pendingDraftSavedAt?: string
  showDraftActions?: boolean
  onUseDifferentAccount: () => void
  onUseAnotherEmail?: () => void
  onRetryAccountAccess?: () => void
  onResumeDraft?: () => void
  onDiscardDraft?: () => void
  onAccountEmailChange: (value: string) => void
  onFieldChange: SetWizardField
}

function DraftActions({
  pendingDraftEmail,
  pendingDraftSavedAt,
  onDiscardDraft,
  onResumeDraft,
}: {
  pendingDraftEmail?: string
  pendingDraftSavedAt?: string
  onDiscardDraft?: () => void
  onResumeDraft?: () => void
}) {
  return (
    <section className="rounded-2xl border border-[rgba(191,219,254,0.32)] bg-[rgba(15,23,42,0.72)] p-4">
      <p className="text-sm font-semibold text-[#f8fafc]">Continuar cadastro da empresa</p>
      <p className="mt-1 text-xs text-[#cbd5e1]">
        Encontramos um rascunho para <strong>{pendingDraftEmail}</strong>
        {pendingDraftSavedAt ? ` salvo em ${pendingDraftSavedAt}.` : '.'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onDiscardDraft}
          className="rounded-xl border border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.7)] px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:bg-[rgba(30,41,59,0.88)]"
        >
          Comecar do zero
        </button>
        <button
          type="button"
          onClick={onResumeDraft}
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          Continuar de onde parou
        </button>
      </div>
    </section>
  )
}

export function Step1Account({
  data,
  errors,
  isAuthenticated,
  currentEmail,
  accountLoading,
  verificationEmail,
  verificationMessage,
  pendingDraftEmail,
  pendingDraftSavedAt,
  showDraftActions = false,
  onUseDifferentAccount,
  onUseAnotherEmail,
  onRetryAccountAccess,
  onResumeDraft,
  onDiscardDraft,
  onAccountEmailChange,
  onFieldChange,
}: Step1AccountProps) {
  if (isAuthenticated) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-[rgba(74,222,128,0.35)] bg-[rgba(20,83,45,0.28)] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(74,222,128,0.38)] bg-[rgba(21,128,61,0.3)] text-[#bbf7d0]">
              <ShieldCheck size={18} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#f0fdf4]">Conta autenticada</p>
              <p className="text-xs text-[#bbf7d0]">
                Voce ja esta logado como <strong>{currentEmail || 'usuario autenticado'}</strong>. Clique em
                continuar para prosseguir com o cadastro da empresa.
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

        {showDraftActions && (
          <DraftActions
            pendingDraftEmail={pendingDraftEmail}
            pendingDraftSavedAt={pendingDraftSavedAt}
            onDiscardDraft={onDiscardDraft}
            onResumeDraft={onResumeDraft}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {verificationEmail && (
        <section className="rounded-2xl border border-[rgba(96,165,250,0.35)] bg-[rgba(30,41,59,0.72)] p-4">
          <p className="text-sm font-semibold text-[#eff6ff]">Conta aguardando confirmacao</p>
          <p className="mt-1 text-xs text-[#bfdbfe]">
            {verificationMessage || (
              <>
                A conta para <strong>{verificationEmail}</strong> ja foi criada. Confirme o email e depois entre para
                continuar o cadastro da empresa.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onUseAnotherEmail}
              className="rounded-xl border border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.7)] px-4 py-2 text-sm font-semibold text-[#cbd5e1] transition hover:bg-[rgba(30,41,59,0.88)]"
            >
              Usar outro email
            </button>
            <button
              type="button"
              onClick={onRetryAccountAccess}
              disabled={accountLoading}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accountLoading ? 'Entrando...' : 'Ja confirmei, entrar e continuar'}
            </button>
          </div>
        </section>
      )}

      <Input
        label="Email"
        type="email"
        value={data.accountEmail}
        onChange={(event) => onAccountEmailChange(event.target.value)}
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

      {showDraftActions && (
        <DraftActions
          pendingDraftEmail={pendingDraftEmail}
          pendingDraftSavedAt={pendingDraftSavedAt}
          onDiscardDraft={onDiscardDraft}
          onResumeDraft={onResumeDraft}
        />
      )}

      <p className="text-xs text-[#94a3b8]">
        Esta etapa acontece em <code>/create-shop</code>. Depois de criar a conta, voce segue para os dados da empresa.
      </p>
    </div>
  )
}
