import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Save, Plus, Trash2, Clock, CalendarOff, Copy, Check, Upload, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { supabase, supabaseProjectUrl } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { DatePickerField } from '../components/ui/DatePickerField'
import { TimePickerField } from '../components/ui/TimePickerField'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { AvatarCropModal } from '../components/ui/AvatarCropModal'
import { format, parseISO } from 'date-fns'
import { translateError } from '../lib/errorMessages'
import { getSignedAvatarUrl, uploadShopAvatar, validateAvatarFile, SHOP_AVATARS_BUCKET } from '../lib/avatarStorage'
import {
  buildAddressLine,
  buildAddressSignature,
  formatCep,
  hasMinimumAddressForGeocoding,
  normalizeAndRepairCoordinates,
  normalizeCep,
} from '../lib/location'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone, normalizePhone } from '../lib/phone'
import type { Tables } from '../types/database'

type Shop = Tables<'shops'>
type BusinessHour = Tables<'business_hours'>
type TimeOff = Tables<'time_off'>
type Professional = Tables<'professionals'>
type ShopMember = Tables<'shop_members'>
type SupabaseUpdateError = {
  message?: string
  details?: string
  hint?: string
  code?: string
  status?: number
} | null

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

const GEOCODE_UNAVAILABLE_TTL_MS = 10 * 60 * 1000

function getGeocodeUnavailableKey() {
  return `barberage_geocode_unavailable_${supabaseProjectUrl}`
}

function readGeocodeUnavailable() {
  const blockedAtRaw = window.localStorage.getItem(getGeocodeUnavailableKey())
  const blockedAt = Number.parseInt(blockedAtRaw || '', 10)
  if (!Number.isFinite(blockedAt)) return false
  const expired = Date.now() - blockedAt >= GEOCODE_UNAVAILABLE_TTL_MS
  if (expired) {
    window.localStorage.removeItem(getGeocodeUnavailableKey())
    return false
  }
  return true
}

function markGeocodeUnavailable() {
  window.localStorage.setItem(getGeocodeUnavailableKey(), String(Date.now()))
}

export function SettingsPage() {
  const { currentShop, membership, refreshUserData, user } = useAuth()
  const isAdmin = membership?.role === 'admin'

  const [activeTab, setActiveTab] = useState<'shop' | 'hours' | 'timeoff' | 'members'>('shop')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Configurações</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Configure sua barbearia
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
        {[
          { key: 'shop' as const, label: 'Dados da barbearia' },
          { key: 'hours' as const, label: 'Horários' },
          { key: 'timeoff' as const, label: 'Folgas e bloqueios' },
          { key: 'members' as const, label: 'Equipe' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'shop' && (
        <ShopSettings
          shop={currentShop}
          isAdmin={isAdmin}
          onShopUpdated={refreshUserData}
          userId={user?.id}
        />
      )}
      {activeTab === 'hours' && <BusinessHoursSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
      {activeTab === 'timeoff' && <TimeOffSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
      {activeTab === 'members' && <MembersSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
    </div>
  )
}

function ShopSettings({
  shop,
  isAdmin,
  onShopUpdated,
  userId,
}: {
  shop: Shop | null
  isAdmin: boolean
  onShopUpdated: () => Promise<void>
  userId: string | undefined
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [timezone, setTimezone] = useState('')
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState('30')
  const [bufferMinutes, setBufferMinutes] = useState('0')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [geoWarning, setGeoWarning] = useState('')
  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [geocodeEndpointUnavailable, setGeocodeEndpointUnavailable] = useState(false)
  const [cepError, setCepError] = useState('')
  const [cepErrorCode, setCepErrorCode] = useState<'invalid' | 'request' | ''>('')
  const [cepLoading, setCepLoading] = useState(false)
  const [latestLookupCep, setLatestLookupCep] = useState<string | null>(null)

  function isSchemaCompatibilityError(message: string) {
    const normalized = message.toLowerCase()
    return (
      normalized.includes('schema cache') ||
      normalized.includes('does not exist') ||
      normalized.includes('column') ||
      normalized.includes('pgrst204')
    )
  }

  function buildErrorText(error: SupabaseUpdateError) {
    return [
      error?.message || '',
      error?.details || '',
      error?.hint || '',
      error?.code || '',
    ]
      .join(' ')
      .toLowerCase()
  }

  function isRelationCompatibilityError(error: SupabaseUpdateError) {
    const errorText = buildErrorText(error)
    return (
      isSchemaCompatibilityError(errorText) ||
      errorText.includes('cannot update view') ||
      errorText.includes('permission denied for view') ||
      errorText.includes('permission denied for table') ||
      (errorText.includes('relation') && errorText.includes('does not exist'))
    )
  }

  function normalizeCoordinates(latitudeLike: unknown, longitudeLike: unknown, source: string) {
    const normalized = normalizeAndRepairCoordinates(latitudeLike, longitudeLike)
    if (!normalized) {
      return {
        latitude: null,
        longitude: null,
        wasSwapped: false,
      }
    }

    if (normalized.wasSwapped && import.meta.env.DEV) {
      console.warn('[settings][coords] lat/lng invertidos detectados e corrigidos', {
        source,
        before: { latitudeLike, longitudeLike },
        after: { latitude: normalized.latitude, longitude: normalized.longitude },
      })
    }

    return normalized
  }

  function sanitizePayload(payload: Record<string, unknown>) {
    const entries = Object.entries(payload).filter(([, value]) => {
      if (value === undefined) return false
      if (typeof value === 'number' && !Number.isFinite(value)) return false
      return true
    })
    return Object.fromEntries(entries)
  }

  function readText(value: unknown) {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return ''
  }

  function applyShopRecordToForm(record: Partial<Shop> & Record<string, unknown>) {
    const rawName = readText(record.name)
    const rawPhone = readText(record.phone)
    const rawCep = readText(record.cep)
    const rawStreet = readText(record.address_street) || readText(record.street) || readText(record.address)
    const rawNumber = readText(record.address_number) || readText(record.number)
    const rawComplement = readText(record.complement)
    const rawNeighborhood = readText(record.neighborhood)
    const rawCity = readText(record.city)
    const rawState = readText(record.state) || readText(record.uf)
    const rawTimezone = readText(record.timezone)
    const parsedCoords = normalizeCoordinates(record.latitude, record.longitude, 'shop-record')
    const parsedSlotInterval = Number.parseInt(readText(record.slot_interval_minutes), 10)
    const parsedBuffer = Number.parseInt(readText(record.buffer_minutes), 10)

    setName(rawName)
    setPhone(formatPhone(rawPhone))
    setCep(formatCep(rawCep))
    setAddressStreet(rawStreet)
    setAddressNumber(rawNumber)
    setComplement(rawComplement)
    setNeighborhood(rawNeighborhood)
    setCity(rawCity)
    setStateCode(rawState.toUpperCase())
    setLatitude(parsedCoords.latitude)
    setLongitude(parsedCoords.longitude)
    setTimezone(rawTimezone || 'America/Sao_Paulo')
    setSlotIntervalMinutes(String(Number.isInteger(parsedSlotInterval) ? parsedSlotInterval : 30))
    setBufferMinutes(String(Number.isInteger(parsedBuffer) ? parsedBuffer : 0))
  }

  function payloadTypeMap(payload: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => {
        if (value === null) return [key, 'null']
        if (Array.isArray(value)) return [key, 'array']
        return [key, typeof value]
      })
    )
  }

  function getPublicBaseUrl() {
    const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim()
    if (configured) return configured.replace(/\/+$/, '')
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }

  function buildPublicShopUrl(slug: string) {
    return `${getPublicBaseUrl()}/barbearias/${slug}`
  }

  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value
    const currentCaret = e.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, currentCaret)
    const formattedValue = formatPhone(rawValue)
    const nextCaret = caretIndexFromDigitCount(formattedValue, digitsBeforeCaret)

    setPhone(formattedValue)

    requestAnimationFrame(() => {
      e.target.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function handleCepChange(e: ChangeEvent<HTMLInputElement>) {
    setCep(formatCep(e.target.value))
  }

  useEffect(() => {
    if (shop) {
      applyShopRecordToForm(shop as Partial<Shop> & Record<string, unknown>)
    }
  }, [shop])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setGeocodeEndpointUnavailable(readGeocodeUnavailable())
  }, [shop?.id])

  useEffect(() => {
    const normalizedCep = normalizeCep(cep)

    if (normalizedCep.length !== 8) {
      setCepError('')
      setCepErrorCode('')
      setCepLoading(false)
      setLatestLookupCep(null)
      return
    }

    if (latestLookupCep === normalizedCep) return

    const abortController = new AbortController()
    setLatestLookupCep(normalizedCep)

    async function fetchCepData() {
      setCepError('')
      setCepErrorCode('')
      setCepLoading(true)

      try {
        const response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error('request-failed')
        }

        const data = (await response.json()) as ViaCepResponse

        if (data.erro) {
          setCepError('CEP inválido')
          setCepErrorCode('invalid')
          return
        }

        const nextStreet = data.logradouro?.trim()
        const nextNeighborhood = data.bairro?.trim()
        const nextCity = data.localidade?.trim()
        const nextState = data.uf?.trim().toUpperCase()

        if (nextStreet) setAddressStreet(nextStreet)
        if (nextNeighborhood) setNeighborhood(nextNeighborhood)
        if (nextCity) setCity(nextCity)
        if (nextState) setStateCode(nextState)
      } catch {
        if (abortController.signal.aborted) return
        setCepError('Nao foi possivel buscar o CEP')
        setCepErrorCode('request')
      } finally {
        if (!abortController.signal.aborted) {
          setCepLoading(false)
        }
      }
    }

    void fetchCepData()

    return () => {
      abortController.abort()
    }
  }, [cep, latestLookupCep])

  useEffect(() => {
    let mounted = true
    async function loadPreview() {
      const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop?.avatar_url)
      if (mounted) setAvatarPreview(signed)
    }
    loadPreview()
    return () => {
      mounted = false
    }
  }, [shop?.avatar_url])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shop) return
    const shopId = shop.id

    const normalizedName = name.trim()
    const normalizedPhone = normalizePhone(phone)
    const normalizedCep = normalizeCep(cep)
    const normalizedStreet = addressStreet.trim()
    const normalizedNumber = addressNumber.trim()
    const normalizedNeighborhood = neighborhood.trim()
    const normalizedCity = city.trim()
    const normalizedState = stateCode.trim().toUpperCase()
    const normalizedComplement = complement.trim()
    const parsedSlotInterval = Number.parseInt(slotIntervalMinutes, 10)
    const parsedBuffer = Number.parseInt(bufferMinutes, 10)
    const addressLine = buildAddressLine({
      address_street: normalizedStreet,
      address_number: normalizedNumber,
      neighborhood: normalizedNeighborhood,
    })

    if (!normalizedName) {
      setSaveError('Informe o nome da barbearia.')
      return
    }

    if (!normalizedCep || !normalizedNumber) {
      setSaveError('Informe CEP e número para precisão.')
      return
    }

    if (normalizedCep.length !== 8) {
      setSaveError('Informe um CEP válido.')
      return
    }

    if (cepErrorCode === 'invalid') {
      setSaveError('CEP inválido.')
      return
    }

    if (!normalizedStreet || !normalizedNumber || !normalizedCity || normalizedState.length !== 2) {
      setSaveError('Preencha rua, número, cidade e UF.')
      return
    }

    if (!Number.isInteger(parsedSlotInterval) || parsedSlotInterval < 5 || parsedSlotInterval > 120) {
      setSaveError('Intervalo de slots deve estar entre 5 e 120 minutos.')
      return
    }

    if (!Number.isInteger(parsedBuffer) || parsedBuffer < 0 || parsedBuffer > 120) {
      setSaveError('Buffer deve estar entre 0 e 120 minutos.')
      return
    }

    const currentAddressSignature = buildAddressSignature({
      cep: shop.cep,
      address_street: shop.address_street,
      address_number: shop.address_number,
      neighborhood: shop.neighborhood,
      city: shop.city,
      state: shop.state,
      complement: shop.complement,
    })
    const nextAddressSignature = buildAddressSignature({
      cep: normalizedCep,
      address_street: normalizedStreet,
      address_number: normalizedNumber,
      neighborhood: normalizedNeighborhood,
      city: normalizedCity,
      state: normalizedState,
      complement: normalizedComplement,
    })
    const existingCoords = normalizeCoordinates(shop.latitude, shop.longitude, 'current-shop')
    const hasCurrentCoordinates = existingCoords.latitude !== null && existingCoords.longitude !== null
    const addressChanged = currentAddressSignature !== nextAddressSignature
    const shouldGeocode =
      hasMinimumAddressForGeocoding({
        cep: normalizedCep,
        address_street: normalizedStreet,
        address_number: normalizedNumber,
        neighborhood: normalizedNeighborhood,
        city: normalizedCity,
        state: normalizedState,
      }) && (addressChanged || !hasCurrentCoordinates)

    setLoading(true)
    setSuccess(false)
    setSaveError('')
    setGeoWarning('')

    const normalizedLatitude = addressChanged ? null : existingCoords.latitude
    const normalizedLongitude = addressChanged ? null : existingCoords.longitude
    const normalizedTimezone = timezone.trim() || 'America/Sao_Paulo'

    const fullPayloadCandidate = {
      name: normalizedName,
      phone: normalizedPhone || null,
      cep: normalizedCep,
      address_street: normalizedStreet || null,
      address_number: normalizedNumber || null,
      complement: normalizedComplement || null,
      address: addressLine || null,
      neighborhood: normalizedNeighborhood || null,
      city: normalizedCity || null,
      state: normalizedState || null,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      timezone: normalizedTimezone,
      slot_interval_minutes: parsedSlotInterval,
      buffer_minutes: parsedBuffer,
    }

    const legacyPayloadCandidate = {
      name: normalizedName,
      phone: normalizedPhone || null,
      address: addressLine || null,
      neighborhood: normalizedNeighborhood || null,
      city: normalizedCity || null,
      state: normalizedState || null,
      timezone: normalizedTimezone,
    }

    const availableColumns = new Set(Object.keys(shop as Record<string, unknown>))
    const payload = sanitizePayload(fullPayloadCandidate)
    const legacyPayload = sanitizePayload(legacyPayloadCandidate)

    let updateError: SupabaseUpdateError = null
    let usedLegacyFallback = false
    let updatedShopRecord: (Partial<Shop> & Record<string, unknown>) | null = null
    const attemptedUpdates: Array<{
      relation: 'barbershops' | 'shops'
      mode: 'full' | 'legacy'
      error: SupabaseUpdateError
    }> = []

    async function tryUpdateRelation(
      relation: 'barbershops' | 'shops',
      mode: 'full' | 'legacy',
      updatePayload: Record<string, unknown>
    ) {
      if (import.meta.env.DEV) {
        console.info('[settings][shop-update] request', {
          relation,
          mode,
          shopId,
          payload: updatePayload,
          payloadTypes: payloadTypeMap(updatePayload),
          availableColumns: Array.from(availableColumns).sort(),
        })
      }
      const { data, error } = await supabase
        .from(relation)
        .update(updatePayload)
        .eq('id', shopId)
        .select('*')
        .maybeSingle()
      const parsedError = (error as SupabaseUpdateError) || null
      const parsedData = (data as (Partial<Shop> & Record<string, unknown>) | null) || null

      if (import.meta.env.DEV) {
        if (parsedError) {
          console.error('[settings][shop-update] response error', {
            relation,
            mode,
            shopId,
            status: parsedError.status ?? null,
            message: parsedError.message || '',
            details: parsedError.details || '',
            hint: parsedError.hint || '',
            code: parsedError.code || '',
          })
        } else {
          console.info('[settings][shop-update] response ok', {
            relation,
            mode,
            shopId,
            data: parsedData,
          })
        }
      }

      return { error: parsedError, data: parsedData }
    }

    const fullShopsUpdate = await tryUpdateRelation('shops', 'full', payload)
    updateError = fullShopsUpdate.error
    updatedShopRecord = fullShopsUpdate.data
    attemptedUpdates.push({ relation: 'shops', mode: 'full', error: updateError })

    if (updateError && isRelationCompatibilityError(updateError)) {
      const legacyShopsUpdate = await tryUpdateRelation('shops', 'legacy', legacyPayload)
      attemptedUpdates.push({ relation: 'shops', mode: 'legacy', error: legacyShopsUpdate.error })
      if (!legacyShopsUpdate.error) {
        updateError = null
        updatedShopRecord = legacyShopsUpdate.data
        usedLegacyFallback = true
      } else {
        updateError = legacyShopsUpdate.error
      }
    }

    if (updateError && isRelationCompatibilityError(updateError)) {
      const fullBarbershopsUpdate = await tryUpdateRelation('barbershops', 'full', payload)
      attemptedUpdates.push({ relation: 'barbershops', mode: 'full', error: fullBarbershopsUpdate.error })
      if (!fullBarbershopsUpdate.error) {
        updateError = null
        updatedShopRecord = fullBarbershopsUpdate.data
      } else {
        updateError = fullBarbershopsUpdate.error
      }
    }

    if (updateError && isRelationCompatibilityError(updateError)) {
      const legacyBarbershopsUpdate = await tryUpdateRelation('barbershops', 'legacy', legacyPayload)
      attemptedUpdates.push({ relation: 'barbershops', mode: 'legacy', error: legacyBarbershopsUpdate.error })
      if (!legacyBarbershopsUpdate.error) {
        updateError = null
        updatedShopRecord = legacyBarbershopsUpdate.data
        usedLegacyFallback = true
      } else {
        updateError = legacyBarbershopsUpdate.error
      }
    }

    if (updateError || !shop) {
      if (import.meta.env.DEV) {
        console.error('[settings][shop-update] failed', {
          shopId,
          payload,
          legacyPayload,
          error: updateError,
          attemptedUpdates: attemptedUpdates.map((attempt) => ({
            relation: attempt.relation,
            mode: attempt.mode,
            failed: Boolean(attempt.error),
            message: attempt.error?.message || '',
            code: attempt.error?.code || '',
          })),
        })
      }
      setSaveError(translateError(updateError?.message || 'Não foi possível salvar.'))
      setLoading(false)
      return
    }

    if (usedLegacyFallback) {
      setGeoWarning('Dados salvos em modo compatível. Aplique as migrations novas para CEP/campos separados/mapa.')
    }

    applyShopRecordToForm({
      ...shop,
      ...(updatedShopRecord || {}),
      ...payload,
    } as Partial<Shop> & Record<string, unknown>)

    try {
      if (shouldGeocode && !usedLegacyFallback && !geocodeEndpointUnavailable) {
        const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke('geocode-shop-location', {
          body: {
            shopId: shop.id,
            cep: normalizedCep,
            city: normalizedCity,
            state: normalizedState,
            neighborhood: normalizedNeighborhood,
            address_street: normalizedStreet,
            address_number: normalizedNumber,
            address: addressLine || null,
            complement: normalizedComplement || null,
            persist: true,
          },
        })

        if (geocodeError) {
          const geocodeStatusCandidate =
            Number((geocodeError as { context?: { status?: number }; status?: number }).context?.status) ||
            Number((geocodeError as { status?: number }).status) ||
            null
          const geocodeResponseUrl =
            (geocodeError as { context?: { url?: string } }).context?.url || `${supabaseProjectUrl}/functions/v1/geocode-shop-location`
          const geocodeErrorText = `${geocodeError.name || ''} ${geocodeError.message || ''}`.toLowerCase()
          const isLocationNotFound =
            geocodeStatusCandidate === 422 || geocodeErrorText.includes('location not found')
          const isFunction404 = geocodeStatusCandidate === 404 || geocodeErrorText.includes('functions fetch failed')

          if (import.meta.env.DEV) {
            console.error('[settings][geocode] invoke error', {
              status: geocodeStatusCandidate,
              url: geocodeResponseUrl,
              name: geocodeError.name,
              message: geocodeError.message,
              raw: geocodeError,
            })
          }

          if (isLocationNotFound) {
            setGeoWarning('Dados salvos, mas esse endereco nao foi localizado no mapa. Confira rua, numero, cidade e UF.')
          } else if (isFunction404) {
            setGeoWarning(
              `Dados salvos, mas o serviço de geolocalização não foi encontrado (404) em ${geocodeResponseUrl}.`
            )
            markGeocodeUnavailable()
            setGeocodeEndpointUnavailable(true)
          } else {
            setGeoWarning('Dados salvos, mas não foi possível atualizar a localização no mapa.')
          }
        } else {
          const geocodePayload = (geocodeData || {}) as Record<string, unknown>
          const parsedCoords = normalizeCoordinates(
            geocodePayload.latitude,
            geocodePayload.longitude,
            'geocode-response'
          )
          if (parsedCoords.latitude !== null && parsedCoords.longitude !== null) {
            setLatitude(parsedCoords.latitude)
            setLongitude(parsedCoords.longitude)
            if (import.meta.env.DEV) {
              console.info('[settings][geocode] resolved destination', {
                shopId: shop.id,
                lat: parsedCoords.latitude,
                lng: parsedCoords.longitude,
                formatted_address:
                  typeof geocodePayload.formatted_address === 'string' ? geocodePayload.formatted_address : null,
              })
            }
          } else {
            setGeoWarning('Dados salvos, mas a geolocalização retornou coordenadas inválidas.')
          }
        }
      } else if (shouldGeocode && !usedLegacyFallback && geocodeEndpointUnavailable) {
        setGeoWarning('Dados salvos. Geolocalização temporariamente desativada porque o endpoint geocode retornou 404 nesta instalação.')
      }
    } catch (geocodeUnexpectedError) {
      const geocodeResponseUrl = `${supabaseProjectUrl}/functions/v1/geocode-shop-location`
      const message =
        geocodeUnexpectedError instanceof Error
          ? geocodeUnexpectedError.message
          : 'Erro inesperado ao atualizar geolocalização.'
      const normalizedMessage = message.toLowerCase()
      const isFunction404 = normalizedMessage.includes('404') || normalizedMessage.includes('functions fetch failed')

      if (import.meta.env.DEV) {
        console.error('[settings][geocode] unexpected failure', {
          url: geocodeResponseUrl,
          message,
          raw: geocodeUnexpectedError,
        })
      }

      if (isFunction404) {
        setGeoWarning(`Dados salvos, mas o serviço de geolocalização não foi encontrado (404) em ${geocodeResponseUrl}.`)
        markGeocodeUnavailable()
        setGeocodeEndpointUnavailable(true)
      } else {
        setGeoWarning('Dados salvos, mas não foi possível atualizar a localização no mapa.')
      }
    }

    setLoading(false)
    setSuccess(true)
    await onShopUpdated()
    setTimeout(() => setSuccess(false), 3000)
  }

  function handleAvatarPick(file: File | null) {
    if (!file) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      setAvatarError(validationError)
      return
    }

    setAvatarError('')
    setPendingAvatarFile(file)
    setCropModalOpen(true)
  }

  async function handleAvatarCropped(croppedFile: File) {
    if (!shop || !userId) {
      setAvatarError('Sessão inválida. Faça login novamente para enviar a imagem.')
      return
    }
    setAvatarLoading(true)

    try {
      const newPath = await uploadShopAvatar({
        file: croppedFile,
        userId,
        previousPath: shop.avatar_url,
      })

      const { error } = await supabase
        .from('barbershops')
        .update({ avatar_url: newPath })
        .eq('id', shop.id)

      if (error) throw error

      await onShopUpdated()
      const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, newPath)
      setAvatarPreview(signed)
      setCropModalOpen(false)
      setPendingAvatarFile(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar imagem'
      setAvatarError(translateError(message))
    } finally {
      setAvatarLoading(false)
    }
  }

  function handleCopyPublicLink() {
    if (!shop) return
    const publicUrl = buildPublicShopUrl(shop.slug)
    navigator.clipboard.writeText(publicUrl)
    setCopiedPublicLink(true)
    setTimeout(() => setCopiedPublicLink(false), 2000)
  }

  const publicShopUrl = shop ? buildPublicShopUrl(shop.slug) : ''

  return (
    <div className="space-y-4">
      {/* Shop media + public URL card */}
      {shop && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Logo da barbearia" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                  <ImageIcon size={22} />
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">Imagem da barbearia</p>
                <p className="text-xs text-[var(--color-text-muted)]">JPG, PNG, WEBP ou GIF. Máximo 2MB.</p>
                <label className="native-upload-trigger">
                  <Upload size={16} />
                  {avatarLoading ? 'Enviando...' : 'Alterar imagem'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={!isAdmin || avatarLoading}
                    onChange={(e) => handleAvatarPick(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            {avatarError && (
              <div className="rounded-lg bg-[var(--color-primary-soft)] p-2 text-xs text-[var(--color-primary)]">{avatarError}</div>
            )}
            <p className="text-sm font-semibold text-[var(--color-text)]">Link público da barbearia</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Compartilhe este link para que clientes visualizem sua página pública e façam agendamentos.
            </p>
            <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
              <div
                title={publicShopUrl}
                className="min-w-0 w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {publicShopUrl}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-none md:flex">
                <button
                  onClick={handleCopyPublicLink}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] md:w-auto"
                >
                  {copiedPublicLink ? <Check size={16} className="text-[var(--color-text)]" /> : <Copy size={16} />}
                  {copiedPublicLink ? 'Copiado!' : 'Copiar'}
                </button>
                <a
                  href={publicShopUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] md:w-auto"
                >
                  <ExternalLink size={16} />
                  Abrir
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Shop info form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-primary)]">
              {saveError}
            </div>
          )}
          {geoWarning && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {geoWarning}
            </div>
          )}
          <Input label="Nome da barbearia" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} required />
          <Input
            label="Telefone"
            value={phone}
            onChange={handlePhoneChange}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
            disabled={!isAdmin}
          />
          <Input
            label="CEP"
            value={cep}
            onChange={handleCepChange}
            helperText={cepLoading ? 'Buscando CEP...' : 'Formato: 00000-000'}
            error={cepError || undefined}
            inputMode="numeric"
            maxLength={9}
            disabled={!isAdmin}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Rua / Logradouro"
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              disabled={!isAdmin}
              required
            />
            <Input
              label="Número"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              disabled={!isAdmin}
              required
            />
          </div>
          <Input label="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)} disabled={!isAdmin} />
          <Input label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} disabled={!isAdmin} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} disabled={!isAdmin} required />
            <Select
              label="UF"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              disabled={!isAdmin}
              required
            >
              <option value="">Selecione</option>
              {BRAZIL_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
          <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!isAdmin}>
            <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
            <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Belem">Belém (GMT-3)</option>
            <option value="America/Recife">Recife (GMT-3)</option>
            <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
            <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Intervalo base (min)"
              value={slotIntervalMinutes}
              onChange={(e) => setSlotIntervalMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              disabled={!isAdmin}
              required
            />
            <Input
              label="Buffer entre atendimentos (min)"
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              disabled={!isAdmin}
              required
            />
          </div>

          {isAdmin && (
            <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center">
              <Button type="submit" loading={loading}>
              <Save size={16} /> Salvar
              </Button>
              {success && <span className="text-sm text-[var(--color-text)]">Salvo com sucesso!</span>}
            </div>
          )}
          {(latitude !== null && longitude !== null) && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Coordenadas atuais: {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          )}
        </form>
      </Card>

      <AvatarCropModal
        open={cropModalOpen}
        title="Editar logo da barbearia"
        file={pendingAvatarFile}
        loading={avatarLoading}
        error={avatarError}
        onClose={() => {
          if (!avatarLoading) {
            setCropModalOpen(false)
            setPendingAvatarFile(null)
          }
        }}
        onFileChange={handleAvatarPick}
        onConfirm={handleAvatarCropped}
      />
    </div>
  )
}

function BusinessHoursSettings({ shopId, isAdmin }: { shopId: string | undefined; isAdmin: boolean }) {
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shopId) loadHours()
  }, [shopId])

  async function loadHours() {
    if (!shopId) return
    setLoading(true)
    const { data } = await supabase
      .from('business_hours')
      .select('*')
      .eq('shop_id', shopId)
      .order('weekday')
    setHours(data || [])
    setLoading(false)
  }

  function getHourForDay(weekday: number): BusinessHour | undefined {
    return hours.find((h) => h.weekday === weekday)
  }

  async function handleSave(weekday: number, startTime: string, endTime: string, closed: boolean) {
    if (!shopId) return
    setSaving(true)

    const existing = getHourForDay(weekday)
    if (existing) {
      await supabase.from('business_hours').update({
        start_time: closed ? null : startTime,
        end_time: closed ? null : endTime,
        closed,
      }).eq('id', existing.id)
    } else {
      await supabase.from('business_hours').insert({
        shop_id: shopId,
        weekday,
        start_time: closed ? null : startTime,
        end_time: closed ? null : endTime,
        closed,
      })
    }

    await loadHours()
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-[var(--color-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Horários de funcionamento</h2>
      </div>

      <div className="space-y-3">
        {WEEKDAYS.map((day) => (
          <DayRow
            key={day.value}
            label={day.label}
            weekday={day.value}
            hour={getHourForDay(day.value)}
            onSave={handleSave}
            disabled={!isAdmin || saving}
          />
        ))}
      </div>
    </Card>
  )
}

function DayRow({
  label,
  weekday,
  hour,
  onSave,
  disabled,
}: {
  label: string
  weekday: number
  hour: BusinessHour | undefined
  onSave: (weekday: number, start: string, end: string, closed: boolean) => void
  disabled: boolean
}) {
  const [startTime, setStartTime] = useState(hour?.start_time || '09:00')
  const [endTime, setEndTime] = useState(hour?.end_time || '19:00')
  const [closed, setClosed] = useState(hour?.closed ?? false)

  useEffect(() => {
    if (hour) {
      setStartTime(hour.start_time || '09:00')
      setEndTime(hour.end_time || '19:00')
      setClosed(hour.closed)
    }
  }, [hour])

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 sm:w-40">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!closed}
            onChange={(e) => setClosed(!e.target.checked)}
            disabled={disabled}
            className="native-check"
          />
          <span className={`text-sm font-medium ${closed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
            {label}
          </span>
        </label>
      </div>

      {!closed && (
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(180px,220px)_auto_minmax(180px,220px)] sm:items-center">
          <TimePickerField
            label="Início"
            value={startTime}
            onChange={setStartTime}
            disabled={disabled}
            columns={3}
          />
          <span className="px-1 text-center text-sm text-[var(--color-text-muted)]">até</span>
          <TimePickerField
            label="Fim"
            value={endTime}
            onChange={setEndTime}
            disabled={disabled}
            columns={3}
          />
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => onSave(weekday, startTime, endTime, closed)}
      >
        Salvar
      </Button>
    </div>
  )
}

function TimeOffSettings({ shopId, isAdmin }: { shopId: string | undefined; isAdmin: boolean }) {
  const [timeOffs, setTimeOffs] = useState<(TimeOff & { professionals: { name: string } | null })[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const [formProfId, setFormProfId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formStartTime, setFormStartTime] = useState('00:00')
  const [formEndDate, setFormEndDate] = useState('')
  const [formEndTime, setFormEndTime] = useState('23:59')
  const [formReason, setFormReason] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (shopId) loadData()
  }, [shopId])

  async function loadData() {
    if (!shopId) return
    setLoading(true)
    const [toRes, profRes] = await Promise.all([
      supabase
        .from('time_off')
        .select('*, professionals(name)')
        .eq('shop_id', shopId)
        .order('start_at', { ascending: false }),
      supabase.from('professionals').select('*').eq('shop_id', shopId).eq('active', true),
    ])
    setTimeOffs((toRes.data as any) || [])
    setProfessionals(profRes.data || [])
    setLoading(false)
  }

  function openNew() {
    setFormProfId('')
    setFormStartDate('')
    setFormStartTime('00:00')
    setFormEndDate('')
    setFormEndTime('23:59')
    setFormReason('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shopId) return
    setFormError('')

    if (!formStartDate || !formEndDate) {
      setFormError('Preencha as datas')
      return
    }

    setFormLoading(true)

    const startAt = new Date(`${formStartDate}T${formStartTime}:00`).toISOString()
    const endAt = new Date(`${formEndDate}T${formEndTime}:00`).toISOString()

    const { error } = await supabase.from('time_off').insert({
      shop_id: shopId,
      professional_id: formProfId || null,
      start_at: startAt,
      end_at: endAt,
      reason: formReason || null,
    })

    if (error) {
      setFormError(translateError(error.message))
      setFormLoading(false)
      return
    }

    setFormLoading(false)
    setModalOpen(false)
    loadData()
  }

  async function handleDelete(id: string) {
    await supabase.from('time_off').delete().eq('id', id)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Folgas e bloqueios</h2>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openNew}>
              <Plus size={14} /> Novo bloqueio
            </Button>
          )}
        </div>

        {timeOffs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            Nenhum bloqueio cadastrado
          </p>
        ) : (
          <div className="space-y-2">
            {timeOffs.map((to) => (
              <div key={to.id} className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {to.professionals?.name || 'Toda a barbearia'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {format(parseISO(to.start_at), 'dd/MM/yyyy HH:mm')} — {format(parseISO(to.end_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                  {to.reason && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{to.reason}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(to.id)}
                    className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo bloqueio de horário">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-primary)]">
              {formError}
            </div>
          )}

          <Select label="Profissional (vazio = toda a barbearia)" value={formProfId} onChange={(e) => setFormProfId(e.target.value)}>
            <option value="">Toda a barbearia</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Data início"
              value={formStartDate}
              onChange={setFormStartDate}
            />
            <TimePickerField
              label="Hora início"
              value={formStartTime}
              onChange={setFormStartTime}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerField
              label="Data fim"
              value={formEndDate}
              onChange={setFormEndDate}
            />
            <TimePickerField
              label="Hora fim"
              value={formEndTime}
              onChange={setFormEndTime}
            />
          </div>

          <Textarea
            label="Motivo"
            value={formReason}
            onChange={(e) => setFormReason(e.target.value)}
            helperText="Ex: Férias, folga..."
          />

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={formLoading}>Criar bloqueio</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function MembersSettings({ shopId, isAdmin }: { shopId: string | undefined; isAdmin: boolean }) {
  const [members, setMembers] = useState<(ShopMember & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (shopId) loadMembers()
  }, [shopId])

  async function loadMembers() {
    if (!shopId) return
    setLoading(true)
    const { data } = await supabase
      .from('shop_members')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at')
    setMembers(data || [])
    setLoading(false)
  }

  async function handleRoleChange(memberId: string, role: string) {
    await supabase.from('shop_members').update({ role: role as any }).eq('id', memberId)
    loadMembers()
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Tem certeza que deseja remover este membro?')) return
    await supabase.from('shop_members').delete().eq('id', memberId)
    loadMembers()
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    professional: 'Profissional',
    reception: 'Recepção',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Membros da equipe</h2>

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {member.user_id.slice(0, 8)}...
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {roleLabels[member.role] || member.role}
              </p>
            </div>

            {isAdmin && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select
                  label="Função"
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="w-full sm:min-w-[170px]"
                >
                  <option value="admin">Admin</option>
                  <option value="professional">Profissional</option>
                  <option value="reception">Recepção</option>
                </Select>
                <button
                  onClick={() => handleRemove(member.id)}
                  className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

