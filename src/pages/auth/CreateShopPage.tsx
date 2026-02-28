import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { translateError } from '../../lib/errorMessages'
import { buildAddressLine, formatCep, normalizeCep } from '../../lib/location'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone, normalizePhone } from '../../lib/phone'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthCard } from '../../components/auth/AuthCard'
import { FormField } from '../../components/auth/FormField'
import { PrimaryButton } from '../../components/auth/PrimaryButton'

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateShopPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cep, setCep] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [complement, setComplement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cepError, setCepError] = useState('')
  const [cepErrorCode, setCepErrorCode] = useState<'invalid' | 'request' | ''>('')
  const [cepLoading, setCepLoading] = useState(false)
  const latestLookupCepRef = useRef<string | null>(null)
  const normalizedCep = normalizeCep(cep)
  const geocodeUnavailableKey = `barberage_geocode_unavailable_${(import.meta.env.VITE_SUPABASE_URL as string || '').trim().replace(/\/+$/, '')}`

  function isSchemaCompatibilityError(message: string) {
    const normalized = message.toLowerCase()
    return (
      normalized.includes('schema cache') ||
      normalized.includes('does not exist') ||
      normalized.includes('column') ||
      normalized.includes('pgrst204')
    )
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

  useEffect(() => {
    if (normalizedCep.length !== 8) {
      setCepError('')
      setCepErrorCode('')
      setCepLoading(false)
      latestLookupCepRef.current = null
      return
    }

    if (latestLookupCepRef.current === normalizedCep) return
    latestLookupCepRef.current = normalizedCep

    const abortController = new AbortController()

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
          setAddressStreet('')
          setNeighborhood('')
          setCity('')
          setState('')
          return
        }

        const nextStreet = data.logradouro?.trim()
        const nextNeighborhood = data.bairro?.trim()
        const nextCity = data.localidade?.trim()
        const nextState = (data.uf || '').trim().toUpperCase()

        if (nextStreet) setAddressStreet(nextStreet)
        if (nextNeighborhood) setNeighborhood(nextNeighborhood)
        if (nextCity) setCity(nextCity)
        if (nextState) setState(nextState)
      } catch {
        if (abortController.signal.aborted) return
        setCepError('Não foi possível buscar o CEP')
        setCepErrorCode('request')
      } finally {
        if (!abortController.signal.aborted) {
          setCepLoading(false)
        }
      }
    }

    void fetchCepData()
    return () => abortController.abort()
  }, [normalizedCep])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    setError('')

    const normalizedName = name.trim()
    const normalizedPhone = normalizePhone(phone)
    const normalizedStreet = addressStreet.trim()
    const normalizedNumber = addressNumber.trim()
    const normalizedNeighborhood = neighborhood.trim()
    const normalizedCity = city.trim()
    const normalizedState = state.trim().toUpperCase()
    const normalizedComplement = complement.trim()

    if (!normalizedName) {
      setError('Informe o nome da barbearia')
      return
    }

    if (normalizedCep.length !== 8) {
      setError('Informe um CEP válido')
      return
    }

    if (cepErrorCode === 'invalid') {
      setError('CEP inválido')
      return
    }

    if (!normalizedStreet || !normalizedNeighborhood || !normalizedCity || normalizedState.length !== 2) {
      setError('Preencha rua, bairro, cidade e UF')
      return
    }

    if (!normalizedNumber) {
      setError('Informe o número do endereço')
      return
    }

    setLoading(true)

    const slug = `${generateSlug(normalizedName)}-${Date.now().toString(36)}`
    const fullAddress = buildAddressLine({
      address_street: normalizedStreet,
      address_number: normalizedNumber,
      neighborhood: normalizedNeighborhood,
    })

    let shop: { id: string } | null = null
    let shopError: { message?: string } | null = null
    let usedLegacyFallback = false

    const fullInsertRes = await supabase
      .from('barbershops')
      .insert({
        name: normalizedName,
        slug,
        phone: normalizedPhone || null,
        cep: normalizedCep,
        address_street: normalizedStreet,
        address_number: normalizedNumber,
        neighborhood: normalizedNeighborhood,
        city: normalizedCity,
        state: normalizedState,
        complement: normalizedComplement || null,
        address: fullAddress || null,
      })
      .select()
      .single()

    shop = fullInsertRes.data
    shopError = fullInsertRes.error

    if (shopError && isSchemaCompatibilityError(shopError.message || '')) {
      const legacyRes = await supabase
        .from('barbershops')
        .insert({
          name: normalizedName,
          slug,
          phone: normalizedPhone || null,
          address: fullAddress || null,
          neighborhood: normalizedNeighborhood || null,
          city: normalizedCity || null,
          state: normalizedState || null,
        })
        .select()
        .single()

      shop = legacyRes.data
      shopError = legacyRes.error
      usedLegacyFallback = !legacyRes.error
    }

    if (shopError) {
      setError(translateError(shopError.message || 'Não foi possível criar a barbearia.'))
      setLoading(false)
      return
    }

    if (!shop) {
      setError('Não foi possível criar a barbearia.')
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase
      .from('shop_members')
      .insert({ shop_id: shop.id, user_id: user.id, role: 'admin' })

    if (memberError) {
      setError(translateError(memberError.message))
      setLoading(false)
      return
    }

    try {
      if (usedLegacyFallback) {
        if (import.meta.env.DEV) {
          console.warn('[create-shop] saved with legacy schema fallback')
        }
      }
      const blockedAtRaw = window.localStorage.getItem(geocodeUnavailableKey)
      const blockedAt = Number.parseInt(blockedAtRaw || '', 10)
      const shouldSkipGeocode = Number.isFinite(blockedAt) && Date.now() - blockedAt < 10 * 60 * 1000

      if (!shouldSkipGeocode) {
        const { error: geocodeError } = await supabase.functions.invoke('geocode-shop-location', {
          body: {
            shopId: shop.id,
            cep: normalizedCep,
            city: normalizedCity,
            state: normalizedState,
            neighborhood: normalizedNeighborhood,
            address_street: normalizedStreet,
            address_number: normalizedNumber,
            complement: normalizedComplement || null,
            persist: true,
          },
        })

        if (geocodeError) {
          const status =
            Number((geocodeError as { context?: { status?: number }; status?: number }).context?.status) ||
            Number((geocodeError as { status?: number }).status) ||
            null
          const geocodeErrorText = `${geocodeError.name || ''} ${geocodeError.message || ''}`.toLowerCase()
          if (status === 404 || geocodeErrorText.includes('functions fetch failed')) {
            window.localStorage.setItem(geocodeUnavailableKey, String(Date.now()))
          }
        }
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn('[create-shop] geocoding failed, continuing without coordinates')
      }
    }

    window.location.href = '/app/dashboard'
  }

  return (
    <AuthLayout>
      <AuthCard
        icon={<img src="/apple-touch-icon.png" alt="Ícone BarberAge" className="h-8 w-8 object-contain" />}
        title="BARBERAGE"
        subtitle="Criar barbearia"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          <FormField
            label="Nome da barbearia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText="Ex: Barbearia do Joao"
            required
          />

          <FormField
            label="Telefone"
            value={phone}
            onChange={handlePhoneChange}
            helperText="(11) 99999-9999"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
          />

          <FormField
            label="CEP"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            helperText={cepLoading ? 'Buscando CEP...' : 'Formato: 00000-000'}
            error={cepError || undefined}
            inputMode="numeric"
            maxLength={9}
            required
          />

          <FormField
            label="Rua / Logradouro"
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Numero"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              required
            />
            <FormField
              label="Complemento"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
            />
          </div>

          <FormField
            label="Bairro"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <FormField
              label="UF"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              required
            />
          </div>

          <PrimaryButton type="submit" loading={loading}>
            Criar barbearia
          </PrimaryButton>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

