import { useRef, type ChangeEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { Input } from '../../ui/Input'
import type { WizardData, WizardErrors } from './useWizardState'

type SetWizardField = <K extends keyof WizardData>(field: K, value: WizardData[K]) => void

interface Step3OwnerProps {
  data: WizardData
  errors: WizardErrors
  onFieldChange: SetWizardField
  onPhoneChange: (event: ChangeEvent<HTMLInputElement>) => void
  onLogoPick: (file: File | null) => void
}

export function Step3Owner({
  data,
  errors,
  onFieldChange,
  onPhoneChange,
  onLogoPick,
}: Step3OwnerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    onLogoPick(file)
  }

  return (
    <div className="space-y-4">
      <Input
        label="Nome completo do responsavel"
        value={data.ownerName}
        onChange={(event) => onFieldChange('ownerName', event.target.value)}
        error={errors.ownerName}
        autoComplete="name"
      />

      <Input
        label="Telefone"
        value={data.phone}
        onChange={onPhoneChange}
        error={errors.phone}
        helperText="(99) 99999-9999"
        maxLength={15}
        inputMode="numeric"
        autoComplete="tel"
      />

      <Input
        label="Nome da barbearia"
        value={data.shopName}
        onChange={(event) => onFieldChange('shopName', event.target.value)}
        error={errors.shopName}
        autoComplete="organization"
      />

      <section className="rounded-2xl border border-[rgba(148,163,184,0.24)] bg-[rgba(15,23,42,0.72)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#f8fafc]">Logo da barbearia (opcional)</p>
            <p className="text-xs text-[#94a3b8]">PNG ou JPG, maximo de 2MB.</p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(59,130,246,0.48)] bg-[rgba(37,99,235,0.18)] px-3 py-2 text-sm font-semibold text-[#bfdbfe] transition hover:bg-[rgba(37,99,235,0.28)]"
          >
            <ImagePlus size={16} />
            Escolher logo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg"
            onChange={handleLogoChange}
          />
        </div>

        {errors.logoFile && (
          <p className="mt-3 rounded-xl border border-[rgba(248,113,113,0.36)] bg-[rgba(127,29,29,0.3)] px-3 py-2 text-xs text-[#fecaca]">
            {errors.logoFile}
          </p>
        )}

        {data.logoPreviewUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[rgba(148,163,184,0.24)] bg-[rgba(2,6,23,0.65)] p-3">
            <img
              src={data.logoPreviewUrl}
              alt="Preview da logo"
              className="h-14 w-14 rounded-xl border border-[rgba(148,163,184,0.32)] object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#f8fafc]">
                {data.logoFile?.name || 'Logo selecionada'}
              </p>
              <p className="text-xs text-[#94a3b8]">Preview local antes da finalizacao.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
