import { useEffect, useState } from 'react'
import { Check, ChevronLeft, Clock, Scissors, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { translateError } from '../../lib/errorMessages'
import { format, addDays, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Tables } from '../../types/database'

type Service = Tables<'services'>
type Professional = Tables<'professionals'>

type Slot = { slot_start: string; slot_end: string }

type BookingStep = 'service' | 'professional' | 'datetime' | 'confirm'

export function ClientBookingPage() {
  const { clientUser, clientShop } = useAuth()
  const shopId = clientShop?.id

  const [step, setStep] = useState<BookingStep>('service')
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)

  // Selections
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Booking
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  useEffect(() => {
    if (shopId) loadData()
  }, [shopId])

  async function loadData() {
    setLoading(true)
    const [sRes, pRes] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId!).eq('active', true).order('name'),
      supabase.from('professionals').select('*').eq('shop_id', shopId!).eq('active', true).order('name'),
    ])
    setServices(sRes.data || [])
    setProfessionals(pRes.data || [])
    setLoading(false)
  }

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0)
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)

  function toggleService(service: Service) {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    )
  }

  async function loadSlots(date: Date, professional: Professional) {
    if (!shopId) return
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)

    const { data, error } = await supabase.rpc('get_available_slots', {
      p_shop_id: shopId,
      p_professional_id: professional.id,
      p_date: format(date, 'yyyy-MM-dd'),
      p_duration_minutes: totalDuration || 30,
    })

    if (!error && data) {
      setSlots(data as Slot[])
    }
    setSlotsLoading(false)
  }

  function handleDateChange(date: Date) {
    setSelectedDate(date)
    if (selectedProfessional) {
      loadSlots(date, selectedProfessional)
    }
  }

  function handleProfessionalSelect(prof: Professional) {
    setSelectedProfessional(prof)
    setStep('datetime')
    loadSlots(selectedDate, prof)
  }

  async function handleBooking() {
    if (!shopId || !clientUser || !selectedProfessional || !selectedSlot) return
    setBookingError('')
    setBookingLoading(true)

    const { data: apt, error: aptError } = await supabase
      .from('appointments')
      .insert({
        shop_id: shopId,
        client_id: clientUser.client_id,
        professional_id: selectedProfessional.id,
        start_at: selectedSlot.slot_start,
        end_at: selectedSlot.slot_end,
        status: 'pending',
      })
      .select()
      .single()

    if (aptError) {
      if (aptError.message.includes('appointments_no_overlap')) {
        setBookingError('Este horário já foi reservado. Escolha outro.')
      } else {
        setBookingError(translateError(aptError.message))
      }
      setBookingLoading(false)
      return
    }

    // Insert appointment services
    if (selectedServices.length > 0) {
      await supabase.from('appointment_services').insert(
        selectedServices.map((s) => ({
          appointment_id: apt.id,
          service_id: s.id,
          duration_minutes: s.duration_minutes,
          price: s.price,
        }))
      )
    }

    setBookingSuccess(true)
    setBookingLoading(false)
  }

  function resetBooking() {
    setStep('service')
    setSelectedServices([])
    setSelectedProfessional(null)
    setSelectedSlot(null)
    setBookingSuccess(false)
    setBookingError('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  if (bookingSuccess) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Agendamento realizado!</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {format(new Date(selectedSlot!.slot_start), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          com {selectedProfessional?.name}
        </p>
        <Button className="mt-6" onClick={resetBooking}>Fazer novo agendamento</Button>
      </div>
    )
  }

  // Date navigation
  const dates: Date[] = []
  for (let i = 0; i < 14; i++) {
    dates.push(addDays(startOfDay(new Date()), i))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Agendar</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Escolha o serviço, profissional e horário
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex gap-1">
        {(['service', 'professional', 'datetime', 'confirm'] as BookingStep[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              i <= ['service', 'professional', 'datetime', 'confirm'].indexOf(step)
                ? 'bg-emerald-500'
                : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select services */}
      {step === 'service' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            <Scissors className="mr-2 inline h-5 w-5" />
            Selecione os serviços
          </h2>
          {services.map((service) => {
            const isSelected = selectedServices.some((s) => s.id === service.id)
            return (
              <button
                key={service.id}
                onClick={() => toggleService(service)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600'
                }`}
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{service.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {service.duration_minutes} min
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    R$ {Number(service.price).toFixed(2)}
                  </span>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          {selectedServices.length > 0 && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedServices.length} serviço(s) · {totalDuration} min
                  </p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">
                    R$ {totalPrice.toFixed(2)}
                  </p>
                </div>
                <Button onClick={() => setStep('professional')}>Continuar</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Step 2: Select professional */}
      {step === 'professional' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('service')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              <User className="mr-2 inline h-5 w-5" />
              Escolha o profissional
            </h2>
          </div>
          {professionals.map((prof) => (
            <button
              key={prof.id}
              onClick={() => handleProfessionalSelect(prof)}
              className="flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-emerald-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-emerald-600"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {prof.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{prof.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 3: Select date and time */}
      {step === 'datetime' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('professional')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              <Clock className="mr-2 inline h-5 w-5" />
              Escolha data e horário
            </h2>
          </div>

          {/* Date selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((date) => {
              const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
              const isPast = isBefore(date, startOfDay(new Date()))
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => !isPast && handleDateChange(date)}
                  disabled={isPast}
                  className={`flex min-w-[72px] flex-col items-center rounded-xl border px-3 py-2 text-center transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20'
                      : isPast
                        ? 'border-zinc-100 bg-zinc-50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800'
                  }`}
                >
                  <span className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
                    {format(date, 'EEE', { locale: ptBR })}
                  </span>
                  <span className={`text-lg font-bold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {format(date, 'dd')}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {format(date, 'MMM', { locale: ptBR })}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Time slots */}
          {slotsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : slots.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                Nenhum horário disponível nesta data
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.slot_start === slot.slot_start
                return (
                  <button
                    key={slot.slot_start}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {format(new Date(slot.slot_start), 'HH:mm')}
                  </button>
                )
              })}
            </div>
          )}

          {selectedSlot && (
            <Button className="w-full" onClick={() => setStep('confirm')}>
              Continuar
            </Button>
          )}
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('datetime')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Confirmar agendamento</h2>
          </div>

          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-zinc-400 dark:text-zinc-500">Serviços</p>
                {selectedServices.map((s) => (
                  <p key={s.id} className="text-sm text-zinc-900 dark:text-zinc-100">
                    {s.name} — R$ {Number(s.price).toFixed(2)}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-400 dark:text-zinc-500">Profissional</p>
                <p className="text-sm text-zinc-900 dark:text-zinc-100">{selectedProfessional?.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-400 dark:text-zinc-500">Data e horário</p>
                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                  {selectedSlot && format(new Date(selectedSlot.slot_start), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Total ({totalDuration} min)</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white">R$ {totalPrice.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </Card>

          {bookingError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {bookingError}
            </div>
          )}

          <Button className="w-full" loading={bookingLoading} onClick={handleBooking}>
            Confirmar agendamento
          </Button>
        </div>
      )}
    </div>
  )
}
