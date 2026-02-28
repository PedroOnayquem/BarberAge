import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { format, parseISO, isPast } from 'date-fns'
import { UpcomingSection } from '../../components/cliente/appointments/UpcomingSection'
import { HistorySection } from '../../components/cliente/appointments/HistorySection'
import type { ClientAppointment } from '../../components/cliente/appointments/types'

export function ClientAppointmentsPage() {
  const navigate = useNavigate()
  const { clientUser, clientShop } = useAuth()
  const [appointments, setAppointments] = useState<ClientAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [selectedApt, setSelectedApt] = useState<ClientAppointment | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    if (clientUser && clientShop) {
      loadAppointments()
      return
    }
    setLoading(false)
    setAppointments([])
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

    setAppointments((data as ClientAppointment[]) || [])
    setLoading(false)
  }

  function openCancel(appointment: ClientAppointment) {
    setSelectedApt(appointment)
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
    (appointment) =>
      !isPast(parseISO(appointment.start_at)) &&
      appointment.status !== 'cancelled' &&
      appointment.status !== 'completed' &&
      appointment.status !== 'no_show'
  )
  const past = appointments.filter(
    (appointment) =>
      isPast(parseISO(appointment.start_at)) ||
      appointment.status === 'cancelled' ||
      appointment.status === 'completed' ||
      appointment.status === 'no_show'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  if (!clientUser || !clientShop) {
    return (
      <Card>
        <div className="space-y-2 py-4 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Nenhum agendamento ainda</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Explore barbearias e faça seu primeiro agendamento.
          </p>
          <Button onClick={() => navigate('/cliente/barbearias')}>
            Explorar barbearias
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 px-4 py-4 sm:px-5 md:px-0 md:py-0">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Meus Agendamentos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Acompanhe seus agendamentos
        </p>
      </div>

      <UpcomingSection appointments={upcoming} onCancel={openCancel} />
      <HistorySection appointments={past} />

      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancelar agendamento" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)]">
              <XCircle className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Tem certeza que deseja cancelar este agendamento?
            </p>
          </div>
          {selectedApt && (
            <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 text-sm">
              <p className="font-medium text-[var(--color-text)]">
                {format(parseISO(selectedApt.start_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
              <p className="text-[var(--color-text-muted)]">
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
