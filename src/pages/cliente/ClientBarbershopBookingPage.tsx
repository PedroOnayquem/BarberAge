import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, Clock4, MapPin, UserRound } from 'lucide-react'
import { format, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DatePickerCard } from '../../components/ui/DatePickerCard'
import { Card } from '../../components/ui/Card'
import { ShopLocationMap } from '../../components/cliente/marketplace/ShopLocationMap'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import { translateError } from '../../lib/errorMessages'
import { normalizePhone } from '../../lib/phone'
import type { Tables } from '../../types/database'

type Shop = Tables<'shops'>
type Service = Tables<'services'>
type Professional = Tables<'professionals'>

type Slot = { slot_start: string; slot_end: string }

export function ClientBarbershopBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, clientGlobalProfile, refreshUserData } = useAuth()

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

  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  useEffect(() => {
    if (slug) loadPageData(slug)
  }, [slug])

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
      console.info('[slots][client-booking] request', requestPayload)
    }

    const { data, error } = await supabase.rpc('get_available_slots', {
      p_shop_id: shop.id,
      p_professional_id: params.professional.id,
      p_date: requestDate,
      p_duration_minutes: params.service.duration_minutes,
    })

    if (error) {
      if (import.meta.env.DEV) {
        console.error('[slots][client-booking] response error', {
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
      console.info('[slots][client-booking] response ok', {
        ...requestPayload,
        totalSlots: parsedSlots.length,
      })
    }

    setSlotsLoading(false)
  }

  async function handleBook() {
    if (!shop || !selectedService || !selectedProfessional || !selectedSlot || !user) return

    setBookingLoading(true)
    setBookingError('')

    const { data: linkedClient } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('shop_id', shop.id)
      .maybeSingle()

    let clientId = linkedClient?.client_id ?? null

    if (!clientId) {
      const userMeta = (user.user_metadata || {}) as Record<string, unknown>
      const metaName = typeof userMeta.name === 'string' ? userMeta.name : null
      const metaPhone = typeof userMeta.phone === 'string' ? userMeta.phone : null
      const profileName = clientGlobalProfile?.name || metaName || user.email?.split('@')[0] || 'Cliente'
      const profilePhone = clientGlobalProfile?.phone || metaPhone || null
      const normalizedProfilePhone = normalizePhone(profilePhone || '')
      const { data: newClientId, error: registerError } = await supabase.rpc('register_client', {
        p_shop_id: shop.id,
        p_name: profileName,
        p_phone: normalizedProfilePhone || null,
        p_email: user.email || null,
      })

      if (registerError || !newClientId) {
        setBookingError(translateError(registerError?.message || 'Não foi possível vincular seu perfil.'))
        setBookingLoading(false)
        return
      }
      clientId = newClientId as string
      await refreshUserData()
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

  const hasProfessionals = professionals.length > 0
  const hasServices = services.length > 0
  const canLoadSlots = useMemo(
    () => !!selectedService && !!selectedProfessional && hasProfessionals,
    [selectedService, selectedProfessional, hasProfessionals]
  )

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.info('[slots][client-booking] selection state', {
      shopId: shop?.id || null,
      professionalId: selectedProfessional?.id || null,
      serviceId: selectedService?.id || null,
      date: format(selectedDate, 'yyyy-MM-dd'),
      timezone: shop?.timezone || 'America/Sao_Paulo',
      canLoadSlots,
    })
  }, [shop?.id, shop?.timezone, selectedProfessional?.id, selectedService?.id, selectedDate, canLoadSlots])

  useEffect(() => {
    if (!selectedService || !selectedProfessional) return
    loadSlots({ date: selectedDate, professional: selectedProfessional, service: selectedService })
  }, [selectedDate, selectedService, selectedProfessional])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Barbearia não encontrada</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Verifique o link e tente novamente.</p>
        <Link to="/cliente/barbearias" className="mt-5 inline-flex text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
          Voltar para listagem
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 md:px-0 md:py-0">
      <Link to="/cliente/barbearias" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ChevronLeft size={16} />
        Voltar para barbearias
      </Link>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
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

      <ShopLocationMap shop={shop} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">1. Serviço</h2>
          {!hasServices ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Esta barbearia não possui serviços ativos. Solicite ao estabelecimento para configurar o catálogo.
            </p>
          ) : (
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
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">2. Profissional</h2>
          {!hasProfessionals ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Esta barbearia está sem profissionais ativos. Tente outra barbearia ou volte mais tarde.
            </p>
          ) : (
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
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
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

          {!selectedService && (
            <p className="text-sm text-[var(--color-text-muted)]">Selecione serviço e profissional para ver horários.</p>
          )}
          {selectedService && !hasProfessionals && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Não há profissionais disponíveis para gerar horários nesta barbearia.
            </p>
          )}
          {selectedService && hasProfessionals && !selectedProfessional && (
            <p className="text-sm text-[var(--color-text-muted)]">Selecione um profissional para carregar os horários.</p>
          )}

          {canLoadSlots && slotsLoading && (
            <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`slot-skeleton-${index}`}
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
            <p className="text-sm text-[var(--color-text-muted)]">
              Nenhum horário disponível para esta data. Tente outra data.
            </p>
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

      <Card>
        <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Confirmar agendamento</h2>
        {selectedService && (
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">Duração: {selectedService.duration_minutes} min</p>
        )}
        {bookingError && <p className="mb-3 rounded-lg bg-[var(--color-primary-soft)] px-3 py-2 text-sm text-[var(--color-text)]">{bookingError}</p>}
        {bookingSuccess && <p className="mb-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">Agendamento realizado com sucesso.</p>}

        <button
          disabled={!selectedService || !selectedProfessional || !selectedSlot || bookingLoading || bookingSuccess}
          onClick={handleBook}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {bookingLoading ? 'Agendando...' : 'Agendar'}
        </button>
      </Card>
    </div>
  )
}
