import { useEffect, useState, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { DatePickerField } from '../components/ui/DatePickerField'
import { TimePickerField } from '../components/ui/TimePickerField'
import { Card } from '../components/ui/Card'
import { translateError } from '../lib/errorMessages'
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Tables } from '../types/database'

type Appointment = Tables<'appointments'> & {
  clients: { name: string } | null
  professionals: { name: string } | null
  appointment_services: { services: { name: string } | null }[]
}
type Professional = Tables<'professionals'>
type Service = Tables<'services'>
type Client = Tables<'clients'>

const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Pendente', variant: 'warning' },
  confirmed: { label: 'Confirmado', variant: 'info' },
  completed: { label: 'Concluído', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
  no_show: { label: 'Não compareceu', variant: 'default' },
}
const mobileWeekdayMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const

export function AppointmentsPage() {
  const { currentShop } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  )

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formProfessionalId, setFormProfessionalId] = useState('')
  const [formServiceIds, setFormServiceIds] = useState<string[]>([])
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))
  }, [currentWeekStart])

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

  useEffect(() => {
    if (currentShop) loadData()
  }, [currentShop, currentWeekStart])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    setIsMobile(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [])

  function getWeekdayLabel(day: Date) {
    const label = isMobile
      ? mobileWeekdayMap[day.getDay()]
      : format(day, 'EEEE', { locale: ptBR })

    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  async function loadData() {
    if (!currentShop) return
    setLoading(true)

    const [aptsRes, profsRes, srvsRes, clientsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, clients(name), professionals(name), appointment_services(services(name))')
        .eq('shop_id', currentShop.id)
        .gte('start_at', currentWeekStart.toISOString())
        .lte('start_at', weekEnd.toISOString())
        .order('start_at'),
      supabase.from('professionals').select('*').eq('shop_id', currentShop.id).eq('active', true),
      supabase.from('services').select('*').eq('shop_id', currentShop.id).eq('active', true),
      supabase.from('clients').select('*').eq('shop_id', currentShop.id).order('name'),
    ])

    setAppointments((aptsRes.data as any) || [])
    setProfessionals(profsRes.data || [])
    setServices(srvsRes.data || [])
    setClients(clientsRes.data || [])
    setLoading(false)
  }

  function openNewAppointment() {
    setFormClientId('')
    setFormProfessionalId('')
    setFormServiceIds([])
    setFormDate(format(selectedDate, 'yyyy-MM-dd'))
    setFormTime('')
    setFormNotes('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleCreateAppointment() {
    if (!currentShop) return
    setFormError('')

    if (!formClientId || !formProfessionalId || formServiceIds.length === 0 || !formDate || !formTime) {
      setFormError('Preencha todos os campos obrigatórios')
      return
    }

    setFormLoading(true)

    const startAt = new Date(`${formDate}T${formTime}:00`)

    const { error: aptError } = await supabase.rpc('create_appointment_safe', {
      p_shop_id: currentShop.id,
      p_client_id: formClientId,
      p_professional_id: formProfessionalId,
      p_start_at: startAt.toISOString(),
      p_service_ids: formServiceIds,
      p_notes: formNotes || null,
    })

    if (aptError) {
      const lowerMessage = aptError.message.toLowerCase()
      if (
        lowerMessage.includes('appointments_no_overlap') ||
        lowerMessage.includes('horario indisponivel') ||
        lowerMessage.includes('conflito')
      ) {
        setFormError('Conflito de horário! Este profissional já tem um agendamento nesse período.')
      } else {
        setFormError(translateError(aptError.message))
      }
      setFormLoading(false)
      return
    }

    setFormLoading(false)
    setModalOpen(false)
    loadData()
  }

  async function handleUpdateStatus(status: string) {
    if (!selectedAppointment) return
    await supabase.from('appointments').update({ status: status as any }).eq('id', selectedAppointment.id)
    setStatusModalOpen(false)
    setSelectedAppointment(null)
    loadData()
  }

  function toggleServiceId(id: string) {
    setFormServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const dayAppointments = appointments.filter((a) =>
    isSameDay(parseISO(a.start_at), selectedDate)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Agenda</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Gerencie os agendamentos da barbearia
          </p>
        </div>
        <Button onClick={openNewAppointment}>
          <Plus size={16} /> Novo agendamento
        </Button>
      </div>

      {/* Week navigation */}
      <Card className="!rounded-2xl !p-4">
        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
          <button
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]/40 focus-visible:outline-offset-2"
            aria-label="Semana anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold capitalize text-[var(--color-text)]">
              {format(currentWeekStart, 'MMMM, yyyy', { locale: ptBR })}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {format(currentWeekStart, "dd 'de' MMM", { locale: ptBR })} — {format(weekEnd, "dd 'de' MMM", { locale: ptBR })}
            </p>
          </div>
          <button
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]/40 focus-visible:outline-offset-2"
            aria-label="Próxima semana"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate)
            const isToday = isSameDay(day, new Date())
            const dayApts = appointments.filter((a) => isSameDay(parseISO(a.start_at), day))
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center rounded-2xl border border-transparent p-2.5 transition-colors ${
                  isSelected
                    ? 'bg-[var(--color-primary)] text-white'
                    : isToday
                    ? 'border-[color-mix(in_srgb,var(--color-primary)_25%,var(--color-border))] text-[var(--color-text)]'
                    : 'text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                <span className={`text-[10px] font-semibold tracking-[0.08em] ${isMobile ? 'uppercase' : 'capitalize'} ${isSelected ? 'text-white/85' : 'text-[var(--color-text-muted)]'}`}>
                  {getWeekdayLabel(day)}
                </span>
                <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold">
                  {format(day, 'dd')}
                </span>
                {dayApts.length > 0 && (
                  <span className={`mt-1 text-[10px] ${isSelected ? 'text-white/85' : 'text-[var(--color-text-muted)]'}`}>
                    {dayApts.length} agend.
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Day appointments */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </h2>

        {dayAppointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            Nenhum agendamento neste dia
          </p>
        ) : (
          <div className="space-y-3">
            {dayAppointments.map((apt) => {
              const s = statusMap[apt.status] || statusMap.pending
              const srvNames = apt.appointment_services
                ?.map((as_: any) => as_.services?.name)
                .filter(Boolean)
                .join(', ')
              return (
                <div
                  key={apt.id}
                  onClick={() => { setSelectedAppointment(apt); setStatusModalOpen(true) }}
                  className="flex cursor-pointer flex-col gap-3 rounded-lg border border-[var(--color-border)] p-4 transition-colors hover:bg-[var(--color-surface-muted)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[var(--color-text)]">
                        {format(parseISO(apt.start_at), 'HH:mm')}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {format(parseISO(apt.end_at), 'HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-text)]">
                        {apt.clients?.name || 'Cliente'}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {apt.professionals?.name} {srvNames ? `• ${srvNames}` : ''}
                      </p>
                      {apt.notes && (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{apt.notes}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* New appointment modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo agendamento" size="lg">
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-primary)]">
              {formError}
            </div>
          )}

          <Select label="Cliente" value={formClientId} onChange={(e) => setFormClientId(e.target.value)} required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select label="Profissional" value={formProfessionalId} onChange={(e) => setFormProfessionalId(e.target.value)} required>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-[var(--color-text)]">Serviços</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                    formServiceIds.includes(s.id)
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formServiceIds.includes(s.id)}
                    onChange={() => toggleServiceId(s.id)}
                    className="native-check"
                  />
                  <div>
                    <p className="font-medium text-[var(--color-text)]">{s.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.duration_minutes}min • R$ {Number(s.price).toFixed(2)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Data"
              value={formDate}
              onChange={setFormDate}
              minDate={new Date()}
            />
            <TimePickerField label="Horário" value={formTime} onChange={setFormTime} />
          </div>

          <Textarea
            label="Observações"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            helperText="Opcional"
          />

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAppointment} loading={formLoading}>Agendar</Button>
          </div>
        </div>
      </Modal>

      {/* Status update modal */}
      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Atualizar status" size="sm">
        {selectedAppointment && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              {selectedAppointment.clients?.name} — {format(parseISO(selectedAppointment.start_at), 'HH:mm')}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(statusMap).map(([key, val]) => (
                <Button
                  key={key}
                  variant={selectedAppointment.status === key ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleUpdateStatus(key)}
                >
                  {val.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


