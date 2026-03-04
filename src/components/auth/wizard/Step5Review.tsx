import { buildReadableAddress } from '../../../lib/location'
import { BUSINESS_TYPE_OPTIONS, type WizardData } from './useWizardState'

interface Step5ReviewProps {
  data: WizardData
}

function getBusinessTypeLabel(value: WizardData['businessType']) {
  return BUSINESS_TYPE_OPTIONS.find((option) => option.value === value)?.title || 'Nao informado'
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
      <article className="rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.72)] p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[#94a3b8]">Tipo de barbearia</p>
        <p className="mt-1 text-sm font-semibold text-[#f8fafc]">{getBusinessTypeLabel(data.businessType)}</p>
      </article>

      <article className="rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.72)] p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[#94a3b8]">Responsavel e contato</p>
        <p className="mt-1 text-sm font-semibold text-[#f8fafc]">{data.ownerName || '--'}</p>
        <p className="mt-1 text-sm text-[#cbd5e1]">
          {data.shopName || '--'} | {data.phone || '--'}
        </p>
      </article>

      <article className="rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.72)] p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[#94a3b8]">Endereco completo</p>
        <p className="mt-1 text-sm text-[#e2e8f0]">{fullAddress}</p>
      </article>

      <article className="rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.72)] p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[#94a3b8]">Latitude e longitude</p>
        <p className="mt-1 text-sm text-[#e2e8f0]">
          {formatCoordinate(data.latitude)}, {formatCoordinate(data.longitude)}
        </p>
      </article>

      <article className="rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.72)] p-4">
        <p className="text-xs uppercase tracking-[0.1em] text-[#94a3b8]">Configuracoes iniciais</p>
        <ul className="mt-2 space-y-1 text-sm text-[#e2e8f0]">
          <li>Profissionais: {data.professionalsCount || '0'}</li>
          <li>Intervalo base: {data.slotIntervalMinutes || '--'} min</li>
          <li>Buffer: {data.bufferMinutes || '--'} min</li>
          <li>Timezone: {data.timezone || '--'}</li>
        </ul>
      </article>
    </div>
  )
}
