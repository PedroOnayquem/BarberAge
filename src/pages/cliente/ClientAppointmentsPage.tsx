import { useEffect, useState } from 'react'
import { CalendarCheck, Clock, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { format, parseISO, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Appointment {
  id: string
  start_at: string
  end_at: string
  status: string
  notes: string | null
  created_at: string
  professionals: { name: string } | null
  appointment_services: {
    id: string
    duration_minutes: number
    price: number
    services: { name: string } | null
  }[]
}

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

export function ClientAppointmentsPage() {
  const { clientUser, clientShop } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    if (clientUser && clientShop) loadAppointments()
  }, [clientUser, clientShop])

  async function loadAppointments() {
    if (!clientUser || !clientShop) return
    setLoading(true)

    const { data } = await supabase
      .from('appointments')
      .select('*, professionals(name), appointment_services(id, duration_minutes, price, services(name))')
      .eq('shop_id', clientShop.id)
      .eq('client_id', clientUser.client_id)
      .order('start_at', { ascending: false })

    setAppointments((data as any) || [])
    setLoading(false)
  }

  function openCancel(apt: Appointment) {
    setSelectedApt(apt)
    setCancelModalOpen(true)
  }

  async function handleCancel() {
    if (!selectedApt) return
    setCancelLoading(true)
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', selectedApt.id)
    setCancelLoading(false)
    setCancelModalOpen(false)
    loadAppointments()
  }

  const upcoming = appointments.filter(
    (a) => !isPast(parseISO(a.start_at)) && a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show'
  )
  const past = appointments.filter(
    (a) => isPast(parseISO(a.start_at)) || a.status === 'cancelled' || a.status === 'completed' || a.status === 'no_show'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Meus Agendamentos</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Acompanhe seus agendamentos
        </p>
      </div>

      {/* Upcoming */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400 dark:text-zinc-500">Próximos</h2>
        {upcoming.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-8">
              <CalendarCheck className="mb-2 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-400 dark:text-zinc-500">Nenhum agendamento futuro</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} onCancel={() => openCancel(apt)} showCancel />
            ))}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-400 dark:text-zinc-500">Histórico</h2>
          <div className="space-y-3">
            {past.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} />
            ))}
          </div>
        </div>
      )}

      {/* Cancel modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancelar agendamento" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tem certeza que deseja cancelar este agendamento?
            </p>
          </div>
          {selectedApt && (
            <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {format(parseISO(selectedApt.start_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">
                {selectedApt.professionals?.name}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>Voltar</Button>
            <Button variant="danger" loading={cancelLoading} onClick={handleCancel}>Cancelar agendamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AppointmentCard({
  apt,
  onCancel,
  showCancel,
}: {
  apt: Appointment
  onCancel?: () => void
  showCancel?: boolean
}) {
  const totalPrice = apt.appointment_services.reduce((sum, s) => sum + Number(s.price), 0)

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {format(parseISO(apt.start_at), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {apt.professionals?.name}
          </p>
          {apt.appointment_services.length > 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {apt.appointment_services.map((s) => s.services?.name).filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={statusVariants[apt.status] || 'default'}>
            {statusLabels[apt.status] || apt.status}
          </Badge>
          {totalPrice > 0 && (
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              R$ {totalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      {showCancel && onCancel && (apt.status === 'pending' || apt.status === 'confirmed') && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-700">
          <button
            onClick={onCancel}
            className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
          >
            Cancelar agendamento
          </button>
        </div>
      )}
    </Card>
  )
}
