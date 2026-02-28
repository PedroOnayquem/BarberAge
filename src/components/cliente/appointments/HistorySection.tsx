import { AppointmentsList } from './AppointmentsList'
import type { ClientAppointment } from './types'

interface HistorySectionProps {
  appointments: ClientAppointment[]
}

export function HistorySection({ appointments }: HistorySectionProps) {
  if (appointments.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-muted)]">Histórico</h2>
      <AppointmentsList appointments={appointments} />
    </section>
  )
}

