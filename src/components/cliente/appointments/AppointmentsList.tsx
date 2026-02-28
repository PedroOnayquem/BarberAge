import { Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'
import type { ClientAppointment } from './types'

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
}

const statusVariants: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  completed: 'default',
  no_show: 'danger',
}

interface AppointmentsListProps {
  appointments: ClientAppointment[]
  showCancel?: boolean
  onCancel?: (appointment: ClientAppointment) => void
}

function AppointmentCard({
  apt,
  onCancel,
  showCancel,
}: {
  apt: ClientAppointment
  onCancel?: (appointment: ClientAppointment) => void
  showCancel?: boolean
}) {
  const totalPrice = apt.appointment_services.reduce((sum, s) => sum + Number(s.price), 0)

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {format(parseISO(apt.start_at), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">{apt.professionals?.name}</p>
          {apt.appointment_services.length > 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {apt.appointment_services.map((s) => s.services?.name).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={statusVariants[apt.status] || 'default'}>
            {statusLabels[apt.status] || apt.status}
          </Badge>
          {totalPrice > 0 && (
            <span className="text-sm font-semibold text-[var(--color-text)]">
              R$ {totalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      {showCancel && onCancel && (apt.status === 'pending' || apt.status === 'confirmed') && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <button
            onClick={() => onCancel(apt)}
            className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            Cancelar agendamento
          </button>
        </div>
      )}
    </Card>
  )
}

export function AppointmentsList({ appointments, showCancel, onCancel }: AppointmentsListProps) {
  return (
    <div className="space-y-3">
      {appointments.map((apt) => (
        <AppointmentCard key={apt.id} apt={apt} showCancel={showCancel} onCancel={onCancel} />
      ))}
    </div>
  )
}

