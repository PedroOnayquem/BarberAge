import { buildReadableAddress } from '../../../lib/location'
import { BUSINESS_TYPE_OPTIONS, type WizardData } from './useWizardState'

interface Step5ReviewProps {
  data: WizardData
}

function getCategoryLabels(values: WizardData['categorySlugs']) {
  if (values.length === 0) return 'Nao informado'
  return values
    .map((value) => BUSINESS_TYPE_OPTIONS.find((option) => option.value === value)?.title || value)
    .join(', ')
}

function formatCoordinate(value: number | null) {
  if (value === null) return '--'
  return value.toFixed(6)
}

export function Step5Review({ data }: Step5ReviewProps) {
  const fullAddress = buildReadableAddress({
    cep: data.cep,
    address_street: data.street,
    address_number: data.number,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    complement: data.complement,
  })

  return (
    <div className="space-y-3">
      <article className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">Categorias</p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{getCategoryLabels(data.categorySlugs)}</p>
      </article>

      <article className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">Responsavel e contato</p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{data.ownerName || '--'}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {data.shopName || '--'} | {data.phone || '--'}
        </p>
      </article>

      <article className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">Endereco completo</p>
        <p className="mt-1 text-sm text-[var(--color-text)]">{fullAddress}</p>
      </article>

      <article className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">Latitude e longitude</p>
        <p className="mt-1 text-sm text-[var(--color-text)]">
          {formatCoordinate(data.latitude)}, {formatCoordinate(data.longitude)}
        </p>
      </article>

      <article className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">Configuracoes iniciais</p>
        <ul className="mt-2 space-y-1 text-sm text-[var(--color-text)]">
          <li>Profissionais: {data.professionalsCount || '0'}</li>
          <li>Intervalo base: {data.slotIntervalMinutes || '--'} min</li>
          <li>Buffer: {data.bufferMinutes || '--'} min</li>
          <li>Timezone: {data.timezone || '--'}</li>
        </ul>
      </article>
    </div>
  )
}
