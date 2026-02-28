import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, Clock4, MapPin, UserRound } from 'lucide-react'
import { format, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DatePickerCard } from '../../components/ui/DatePickerCard'
import { Card } from '../../components/ui/Card'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import { translateError } from '../../lib/errorMessages'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone, normalizePhone } from '../../lib/phone'
import type { Tables } from '../../types/database'

type Shop = Tables<'shops'>
type Service = Tables<'services'>
type Professional = Tables<'professionals'>

type Slot = { slot_start: string; slot_end: string }

export function BarbershopPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  useEffect(() => {
    if (slug) loadPageData(slug)
  }, [slug])

  function handleProfilePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value
    const currentCaret = e.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, currentCaret)
    const formattedValue = formatPhone(rawValue)
    const nextCaret = caretIndexFromDigitCount(formattedValue, digitsBeforeCaret)

    setProfilePhone(formattedValue)

    requestAnimationFrame(() => {
      e.target.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function loadPageData(shopSlug: string) {
    setLoading(true)
    setBookingError('')
    setBookingSuccess(false)

    const { data: shopData } = await supabase
      .from('barbershops')
      .select('*')
      .eq('slug', shopSlug)
      .single()

    if (!shopData) {
      setShop(null)
      setLoading(false)
      return
    }

    const [servicesRes, professionalsRes] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shopData.id).eq('active', true).order('name'),
      supabase.from('professionals').select('*').eq('shop_id', shopData.id).eq('active', true).order('name'),
    ])

    setShop(shopData)
    setServices((servicesRes.data || []) as Service[])
    setProfessionals((professionalsRes.data || []) as Professional[])
    const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shopData.avatar_url)
    setAvatarUrl(signed)
    setLoading(false)
  }

  async function loadSlots(params: { date: Date; professional: Professional; service: Service }) {
    if (!shop) return
    setSlotsLoading(true)
    setSlotsError('')
    setSelectedSlot(null)
    setSlots([])
    const requestDate = format(params.date, 'yyyy-MM-dd')
    const requestPayload = {
      shopId: shop.id,
      professionalId: params.professional.id,
      serviceId: params.service.id,
      date: requestDate,
      timezone: shop.timezone || 'America/Sao_Paulo',
      durationMinutes: params.service.duration_minutes,
    }

    if (import.meta.env.DEV) {
      console.info('[slots][public-booking] request', requestPayload)
    }

    const { data, error } = await supabase.rpc('get_available_slots', {
      p_shop_id: shop.id,
      p_professional_id: params.professional.id,
      p_date: requestDate,
      p_duration_minutes: params.service.duration_minutes,
    })

    if (error) {
      if (import.meta.env.DEV) {
        console.error('[slots][public-booking] response error', {
          ...requestPayload,
          error,
        })
      }
      setSlotsError('Não foi possível carregar horários agora. Tente novamente em instantes.')
      setSlotsLoading(false)
      return
    }

    const parsedSlots = (Array.isArray(data) ? data : []) as Slot[]
    setSlots(parsedSlots)
    if (import.meta.env.DEV) {
      console.info('[slots][public-booking] response ok', {
        ...requestPayload,
        totalSlots: parsedSlots.length,
      })
    }
    setSlotsLoading(false)
  }

  async function handleBook() {
    if (!shop || !selectedService || !selectedProfessional || !selectedSlot) return

    if (!user) {
      navigate('/cliente/register')
      return
    }

    setBookingLoading(true)
    setBookingError('')

    // Verifica vínculo do usuário com a barbearia; se não existir, cria automaticamente.
    const { data: linkedClient } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('shop_id', shop.id)
      .maybeSingle()

    let clientId = linkedClient?.client_id ?? null

    if (!clientId) {
      const fallbackName = profileName.trim() || user.email?.split('@')[0] || 'Cliente'
      const normalizedProfilePhone = normalizePhone(profilePhone)
      const { data: newClientId, error: registerError } = await supabase.rpc('register_client', {
        p_shop_id: shop.id,
        p_name: fallbackName,
        p_phone: normalizedProfilePhone || null,
        p_email: user.email || null,
      })

      if (registerError || !newClientId) {
        setBookingError(translateError(registerError?.message || 'Não foi possível vincular seu perfil.'))
        setBookingLoading(false)
        return
      }
      clientId = newClientId as string
    }

    const { error: appointmentError } = await supabase.rpc('create_appointment_safe', {
      p_shop_id: shop.id,
      p_client_id: clientId,
      p_professional_id: selectedProfessional.id,
      p_start_at: selectedSlot.slot_start,
      p_service_ids: [selectedService.id],
      p_notes: null,
    })

    if (appointmentError) {
      const lowerMessage = appointmentError.message.toLowerCase()
      const isUnavailable =
        lowerMessage.includes('horario indisponivel') ||
        lowerMessage.includes('appointments_no_overlap') ||
        lowerMessage.includes('conflito')

      if (isUnavailable) {
        setBookingError('Este horário acabou de ser reservado. Escolha outro.')
        await loadSlots({ date: selectedDate, professional: selectedProfessional, service: selectedService })
      } else {
        setBookingError(translateError(appointmentError.message || 'Não foi possível criar o agendamento.'))
      }
      setBookingLoading(false)
      return
    }

    setBookingSuccess(true)
    setBookingLoading(false)
  }

  const canLoadSlots = useMemo(() => !!selectedService && !!selectedProfessional, [selectedService, selectedProfessional])

  useEffect(() => {
    if (!selectedService || !selectedProfessional) return
    loadSlots({ date: selectedDate, professional: selectedProfessional, service: selectedService })
  }, [selectedDate, selectedService, selectedProfessional])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Barbearia não encontrada</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Verifique o link e tente novamente.</p>
          <Link to="/barbearias" className="mt-5 inline-flex text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
            Voltar para listagem
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/barbearias" className="mb-5 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <ChevronLeft size={16} />
          Voltar para barbearias
        </Link>

        <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
          <div className="flex flex-wrap items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`Logo de ${shop.name}`} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-xl font-bold text-[var(--color-text)]">
                {shop.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">{shop.name}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
                <MapPin size={14} />
                {shop.address || 'Endereço não informado'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">1. Serviço</h2>
            <div className="space-y-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedService?.id === service.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  <p className="font-medium">{service.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{service.duration_minutes} min · R$ {Number(service.price).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">2. Profissional</h2>
            <div className="space-y-2">
              {professionals.map((professional) => (
                <button
                  key={professional.id}
                  onClick={() => setSelectedProfessional(professional)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedProfessional?.id === professional.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-text)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  <p className="inline-flex items-center gap-1.5 font-medium">
                    <UserRound size={14} />
                    {professional.name}
                  </p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          <Card>
            <h2 className="mb-3 inline-flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
              <CalendarDays size={16} />
              3. Data
            </h2>
            <DatePickerCard value={selectedDate} minDate={startOfDay(new Date())} locale={ptBR} onChange={setSelectedDate} />
          </Card>

          <Card>
            <h2 className="mb-3 inline-flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
              <Clock4 size={16} />
              4. Horário disponível
            </h2>

            {!canLoadSlots && (
              <p className="text-sm text-[var(--color-text-muted)]">Selecione serviço e profissional para ver horários.</p>
            )}

            {canLoadSlots && slotsLoading && (
              <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`slot-skeleton-public-${index}`}
                    className="h-10 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
                  />
                ))}
              </div>
            )}

            {canLoadSlots && !slotsLoading && slotsError && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                {slotsError}
              </div>
            )}

            {canLoadSlots && !slotsLoading && !slotsError && slots.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Nenhum horário disponível para esta data. Tente outra data.</p>
            )}

            {canLoadSlots && !slotsLoading && slots.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {slots.map((slot) => {
                  const selected = selectedSlot?.slot_start === slot.slot_start
                  return (
                    <button
                      key={slot.slot_start}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-text)]'
                          : 'border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'
                      }`}
                    >
                      {format(new Date(slot.slot_start), 'HH:mm')}
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-4">
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Confirmar agendamento</h2>
          {selectedService && (
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">Duração: {selectedService.duration_minutes} min</p>
          )}

          {!user && (
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">
              Para concluir o agendamento, crie sua conta de cliente nesta barbearia.
            </p>
          )}

          {!!user && !bookingSuccess && (
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Nome</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  placeholder="Seu nome (se for primeiro agendamento)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Telefone</label>
                <input
                  value={profilePhone}
                  onChange={handleProfilePhoneChange}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                  placeholder="Opcional"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={15}
                />
              </div>
            </div>
          )}

          {bookingError && <p className="mb-3 rounded-lg bg-[var(--color-primary-soft)] px-3 py-2 text-sm text-[var(--color-text)]">{bookingError}</p>}
          {bookingSuccess && <p className="mb-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">Agendamento realizado com sucesso.</p>}

          <button
            disabled={!selectedService || !selectedProfessional || !selectedSlot || bookingLoading || bookingSuccess}
            onClick={handleBook}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bookingLoading ? 'Agendando...' : user ? 'Agendar' : 'Criar conta e agendar'}
          </button>
        </Card>
      </div>
    </div>
  )
}
