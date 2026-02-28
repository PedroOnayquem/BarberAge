import { CalendarCheck } from 'lucide-react'
import { Card } from '../../ui/Card'
import { AppointmentsList } from './AppointmentsList'
import type { ClientAppointment } from './types'

interface UpcomingSectionProps {
  appointments: ClientAppointment[]
  onCancel: (appointment: ClientAppointment) => void
}

export function UpcomingSection({ appointments, onCancel }: UpcomingSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--color-text-muted)]">Próximos</h2>
      {appointments.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-8">
            <CalendarCheck className="mb-2 h-10 w-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">Nenhum agendamento futuro</p>
          </div>
        </Card>
      ) : (
        <AppointmentsList appointments={appointments} showCancel onCancel={onCancel} />
      )}
    </section>
  )
}

