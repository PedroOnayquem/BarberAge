import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, Clock, Scissors, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DatePickerCard } from '../../components/ui/DatePickerCard'
import { translateError } from '../../lib/errorMessages'
import { format, startOfDay } from 'date-fns'
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
  const [slotsError, setSlotsError] = useState('')
  const [catalogError, setCatalogError] = useState('')

  // Booking
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  useEffect(() => {
    if (!shopId) {
      setServices([])
      setProfessionals([])
      setLoading(false)
      return
    }
    void loadData()
  }, [shopId])

  async function loadData() {
    setLoading(true)
    setCatalogError('')
    const [sRes, pRes] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopId!).eq('active', true).order('name'),
      supabase.from('professionals').select('*').eq('shop_id', shopId!).eq('active', true).order('name'),
    ])

    if (sRes.error || pRes.error) {
      setCatalogError('Não foi possível carregar o catálogo desta barbearia agora.')
      if (import.meta.env.DEV) {
        console.error('[client-booking] catalog load error', {
          servicesError: sRes.error,
          professionalsError: pRes.error,
        })
      }
    }

    setServices((sRes.data || []) as Service[])
    setProfessionals((pRes.data || []) as Professional[])
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
    setSlotsError('')
    setSlots([])
    setSelectedSlot(null)

    const { data, error } = await supabase.rpc('get_available_slots', {
      p_shop_id: shopId,
      p_professional_id: professional.id,
      p_date: format(date, 'yyyy-MM-dd'),
      p_duration_minutes: totalDuration || 30,
    })

    if (error) {
      setSlotsError('Não foi possível carregar horários agora. Tente novamente em instantes.')
      setSlotsLoading(false)
      return
    }

    if (data) {
      setSlots(data as Slot[])
    }
    setSlotsLoading(false)
  }

  function handleDateChange(date: Date) {
    setSelectedDate(date)
  }

  function handleProfessionalSelect(prof: Professional) {
    setSelectedProfessional(prof)
    setStep('datetime')
  }

  useEffect(() => {
    if (!selectedProfessional || totalDuration <= 0) return
    loadSlots(selectedDate, selectedProfessional)
  }, [selectedDate, selectedProfessional, totalDuration])

  async function handleBooking() {
    if (!shopId || !clientUser || !selectedProfessional || !selectedSlot) return
    setBookingError('')
    setBookingLoading(true)

    const { error: aptError } = await supabase.rpc('create_appointment_safe', {
      p_shop_id: shopId,
      p_client_id: clientUser.client_id,
      p_professional_id: selectedProfessional.id,
      p_start_at: selectedSlot.slot_start,
      p_service_ids: selectedServices.map((service) => service.id),
      p_notes: null,
    })

    if (aptError) {
      const lowerMessage = aptError.message.toLowerCase()
      const isUnavailable =
        lowerMessage.includes('horario indisponivel') ||
        lowerMessage.includes('appointments_no_overlap') ||
        lowerMessage.includes('conflito')

      if (isUnavailable) {
        setBookingError('Este horário já foi reservado. Escolha outro.')
        await loadSlots(selectedDate, selectedProfessional)
      } else {
        setBookingError(translateError(aptError.message))
      }
      setBookingLoading(false)
      return
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b11226] border-t-transparent" />
      </div>
    )
  }

  if (bookingSuccess) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e9eef8]">
          <Check className="h-8 w-8 text-[#0a1f44]" />
        </div>
        <h2 className="text-xl font-bold text-[#0a1f44]">Agendamento realizado!</h2>
        <p className="mt-2 text-sm text-[#6b7a95]">
          {format(new Date(selectedSlot!.slot_start), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>
        <p className="text-sm text-[#6b7a95]">
          com {selectedProfessional?.name}
        </p>
        <Button className="mt-6" onClick={resetBooking}>Fazer novo agendamento</Button>
      </div>
    )
  }

  if (!shopId || !clientUser) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center">
        <h1 className="text-lg font-bold text-[var(--color-text)]">Selecione uma barbearia para agendar</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Não encontramos uma barbearia vinculada ao seu perfil nesta tela.
        </p>
        <Link
          to="/cliente/barbearias"
          className="mt-4 inline-flex rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
        >
          Ver barbearias
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0a1f44]">Agendar</h1>
        <p className="mt-1 text-sm text-[#6b7a95]">
          Escolha o serviço, profissional e horário
        </p>
      </div>

      {catalogError && (
        <div className="rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.2)] px-3 py-2 text-sm text-[#fecaca]">
          {catalogError}
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex gap-1">
        {(['service', 'professional', 'datetime', 'confirm'] as BookingStep[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              i <= ['service', 'professional', 'datetime', 'confirm'].indexOf(step)
                ? 'bg-[#b11226]'
                : 'bg-[#e8edf5]'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select services */}
      {step === 'service' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#0a1f44]">
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
                    ? 'border-[#b11226] bg-[#f1f4f8]'
                    : 'border-[#dbe2ec] bg-white hover:border-[#cfd8e6]'
                }`}
              >
                <div>
                  <p className="font-medium text-[#0a1f44]">{service.name}</p>
                  <p className="text-sm text-[#6b7a95]">
                    {service.duration_minutes} min
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[#0a1f44]">
                    R$ {Number(service.price).toFixed(2)}
                  </span>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b11226]">
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
                  <p className="text-sm text-[#6b7a95]">
                    {selectedServices.length} serviço(s) · {totalDuration} min
                  </p>
                  <p className="text-lg font-bold text-[#0a1f44]">
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
            <button onClick={() => setStep('service')} className="text-[#8b9bb8] hover:text-[#425a7f]">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-[#0a1f44]">
              <User className="mr-2 inline h-5 w-5" />
              Escolha o profissional
            </h2>
          </div>
          {professionals.map((prof) => (
            <button
              key={prof.id}
              onClick={() => handleProfessionalSelect(prof)}
              className="flex w-full items-center gap-4 rounded-xl border border-[#dbe2ec] bg-white p-4 text-left transition-all hover:border-[#b11226] hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9eef8] text-lg font-bold text-[#0a1f44]">
                {prof.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-[#0a1f44]">{prof.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 3: Select date and time */}
      {step === 'datetime' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('professional')} className="text-[#8b9bb8] hover:text-[#425a7f]">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-[#0a1f44]">
              <Clock className="mr-2 inline h-5 w-5" />
              Escolha data e horário
            </h2>
          </div>

          <DatePickerCard
            value={selectedDate}
            minDate={startOfDay(new Date())}
            locale={ptBR}
            onChange={handleDateChange}
          />

          {/* Time slots */}
          {slotsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#b11226] border-t-transparent" />
            </div>
          ) : slotsError ? (
            <Card>
              <p className="py-6 text-center text-sm text-[#8b9bb8]">
                {slotsError}
              </p>
            </Card>
          ) : slots.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-sm text-[#8b9bb8]">
                Nenhum horário disponível nesta data. Tente outra data.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.slot_start === slot.slot_start
                return (
                  <button
                    key={slot.slot_start}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-[#b11226] bg-[#f1f4f8] text-[#0a1f44]'
                        : 'border-[#dbe2ec] bg-white text-[#1f3760] hover:border-[#cfd8e6]'
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
            <button onClick={() => setStep('datetime')} className="text-[#8b9bb8] hover:text-[#425a7f]">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-[#0a1f44]">Confirmar agendamento</h2>
          </div>

          <Card>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-[#8b9bb8]">Serviços</p>
                {selectedServices.map((s) => (
                  <p key={s.id} className="text-sm text-[#0a1f44]">
                    {s.name} — R$ {Number(s.price).toFixed(2)}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-[#8b9bb8]">Profissional</p>
                <p className="text-sm text-[#0a1f44]">{selectedProfessional?.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-[#8b9bb8]">Data e horário</p>
                <p className="text-sm text-[#0a1f44]">
                  {selectedSlot && format(new Date(selectedSlot.slot_start), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="border-t border-[#e8edf5] pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6b7a95]">Total ({totalDuration} min)</p>
                  <p className="text-lg font-bold text-[#0a1f44]">R$ {totalPrice.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </Card>

          {bookingError && (
            <div className="rounded-lg bg-[#fdecef] p-3 text-sm text-[#b11226]">
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


