import { useEffect, useState, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
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
  addMinutes,
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

    const selectedServices = services.filter((s) => formServiceIds.includes(s.id))
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0)
    const startAt = new Date(`${formDate}T${formTime}:00`)
    const endAt = addMinutes(startAt, totalDuration)

    const { data: apt, error: aptError } = await supabase
      .from('appointments')
      .insert({
        shop_id: currentShop.id,
        client_id: formClientId,
        professional_id: formProfessionalId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        notes: formNotes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (aptError) {
      if (aptError.message.includes('appointments_no_overlap')) {
        setFormError('Conflito de horário! Este profissional já tem um agendamento nesse período.')
      } else {
        setFormError(translateError(aptError.message))
      }
      setFormLoading(false)
      return
    }

    const aptServices = selectedServices.map((s) => ({
      appointment_id: apt.id,
      service_id: s.id,
      duration_minutes: s.duration_minutes,
      price: s.price,
    }))

    await supabase.from('appointment_services').insert(aptServices)

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Agenda</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os agendamentos da barbearia
          </p>
        </div>
        <Button onClick={openNewAppointment}>
          <Plus size={16} /> Novo agendamento
        </Button>
      </div>

      {/* Week navigation */}
      <Card className="!p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {format(currentWeekStart, "dd 'de' MMM", { locale: ptBR })} — {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
          </span>
          <button
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate)
            const isToday = isSameDay(day, new Date())
            const dayApts = appointments.filter((a) => isSameDay(parseISO(a.start_at), day))
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center rounded-xl p-2 transition-colors ${
                  isSelected
                    ? 'bg-amber-600 text-white dark:bg-amber-500'
                    : isToday
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                <span className={`text-xs font-medium ${isMobile ? 'uppercase' : 'capitalize'}`}>
                  {getWeekdayLabel(day)}
                </span>
                <span className="mt-1 text-lg font-bold">{format(day, 'dd')}</span>
                {dayApts.length > 0 && (
                  <span className={`mt-1 text-xs ${isSelected ? 'text-amber-100' : 'text-zinc-400'}`}>
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
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </h2>

        {dayAppointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
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
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-100 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {format(parseISO(apt.start_at), 'HH:mm')}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {format(parseISO(apt.end_at), 'HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {apt.clients?.name || 'Cliente'}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {apt.professionals?.name} {srvNames ? `• ${srvNames}` : ''}
                      </p>
                      {apt.notes && (
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{apt.notes}</p>
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
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}

          <Select label="Cliente" value={formClientId} onChange={(e) => setFormClientId(e.target.value)} required>
            <option value="">Selecione um cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <Select label="Profissional" value={formProfessionalId} onChange={(e) => setFormProfessionalId(e.target.value)} required>
            <option value="">Selecione um profissional</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Serviços</label>
            <div className="grid grid-cols-2 gap-2">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                    formServiceIds.includes(s.id)
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-600 dark:hover:border-zinc-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formServiceIds.includes(s.id)}
                    onChange={() => toggleServiceId(s.id)}
                    className="accent-amber-600"
                  />
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{s.name}</p>
                    <p className="text-xs text-zinc-500">{s.duration_minutes}min • R$ {Number(s.price).toFixed(2)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
            <Input label="Horário" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} required />
          </div>

          <Input label="Observações" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Opcional" />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAppointment} loading={formLoading}>Agendar</Button>
          </div>
        </div>
      </Modal>

      {/* Status update modal */}
      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Atualizar status" size="sm">
        {selectedAppointment && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {selectedAppointment.clients?.name} — {format(parseISO(selectedAppointment.start_at), 'HH:mm')}
            </p>
            <div className="grid grid-cols-2 gap-2">
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
