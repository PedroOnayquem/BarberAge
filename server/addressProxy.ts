const DEFAULT_TIMEOUT_MS = 8000
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

export interface CepLookupResult {
  cep: string
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface GeocodeLookupParams {
  address?: string | null
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
}

export interface GeocodeLookupResult {
  latitude: number | null
  longitude: number | null
  precision: 'address' | 'district' | 'city' | 'cep' | null
  query: string | null
  fallbackUsed: boolean
  notFound: boolean
  triedQueries: string[]
}

export class AddressLookupError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AddressLookupError'
    this.status = status
    this.code = code
  }
}

function normalizeText(value: string | null | undefined) {
  return (value || '').trim()
}

export function parseCep(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '').slice(0, 8)
}

export function formatCep(value: string | null | undefined) {
  const digits = parseCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function buildAddressLine(street: string, number: string, neighborhood: string) {
  const base = street && number ? `${street}, ${number}` : street || number || ''
  return [base, neighborhood].filter(Boolean).join(', ')
}

export function buildFullAddress(parts: {
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
}) {
  const street = normalizeText(parts.street)
  const number = normalizeText(parts.number)
  const neighborhood = normalizeText(parts.neighborhood)
  const city = normalizeText(parts.city)
  const state = normalizeText(parts.state).toUpperCase()
  const cep = formatCep(parts.cep)
  const cityState = [city, state].filter(Boolean).join(' - ')

  return [buildAddressLine(street, number, neighborhood), cityState, cep, 'Brasil'].filter(Boolean).join(', ')
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AddressLookupError(504, 'timeout', 'Tempo esgotado na consulta externa')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function parseCepResponse(payload: unknown, requestedCep: string): CepLookupResult {
  const data = (payload || {}) as Partial<CepLookupResult> & { erro?: boolean }
  if (data.erro) {
    return {
      cep: formatCep(requestedCep),
      logradouro: '',
      bairro: '',
      localidade: '',
      uf: '',
      erro: true,
    }
  }

  return {
    cep: typeof data.cep === 'string' && data.cep ? data.cep : formatCep(requestedCep),
    logradouro: typeof data.logradouro === 'string' ? data.logradouro.trim() : '',
    bairro: typeof data.bairro === 'string' ? data.bairro.trim() : '',
    localidade: typeof data.localidade === 'string' ? data.localidade.trim() : '',
    uf: typeof data.uf === 'string' ? data.uf.trim().toUpperCase() : '',
  }
}

export async function lookupCepServer(rawCep: string): Promise<CepLookupResult> {
  const cep = parseCep(rawCep)
  if (cep.length !== 8) {
    throw new AddressLookupError(400, 'invalid_cep', 'CEP deve conter 8 digitos')
  }

  const response = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new AddressLookupError(502, 'viacep_unavailable', `ViaCEP retornou status ${response.status}`)
  }

  const json = await response.json()
  return parseCepResponse(json, cep)
}

function pushQuery(list: Array<{ query: string; precision: GeocodeLookupResult['precision'] }>, query: string, precision: GeocodeLookupResult['precision']) {
  const normalized = query.trim()
  if (!normalized) return
  if (list.some((item) => item.query === normalized)) return
  list.push({ query: normalized, precision })
}

function buildGeocodeQueries(params: GeocodeLookupParams) {
  const address = normalizeText(params.address)
  const street = normalizeText(params.street)
  const number = normalizeText(params.number)
  const neighborhood = normalizeText(params.neighborhood)
  const city = normalizeText(params.city)
  const state = normalizeText(params.state).toUpperCase()
  const cepDigits = parseCep(params.cep)
  const cepFormatted = formatCep(cepDigits)

  const queries: Array<{ query: string; precision: GeocodeLookupResult['precision'] }> = []

  if (address) {
    pushQuery(queries, `${address}, Brasil`, 'address')
  }

  const fullAddress = buildFullAddress({
    street,
    number,
    neighborhood,
    city,
    state,
    cep: cepDigits,
  })
  pushQuery(queries, fullAddress, 'address')

  pushQuery(queries, [neighborhood, city, state, cepFormatted, 'Brasil'].filter(Boolean).join(', '), 'district')
  pushQuery(queries, [city, state, cepFormatted, 'Brasil'].filter(Boolean).join(', '), 'city')
  pushQuery(queries, [city, state, 'Brasil'].filter(Boolean).join(', '), 'city')
  pushQuery(queries, [cepFormatted, 'Brasil'].filter(Boolean).join(', '), 'cep')

  return queries
}

async function searchNominatim(query: string) {
  const url = new URL(NOMINATIM_ENDPOINT)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('q', query)

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR',
      'User-Agent': 'Barberage/1.0 (geocode-proxy)',
    },
  }, 10000)

  if (!response.ok) {
    throw new AddressLookupError(502, 'geocode_unavailable', `Nominatim retornou status ${response.status}`)
  }

  const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>
  if (!Array.isArray(payload) || payload.length === 0) return null

  const first = payload[0]
  const latitude = toNumber(first.lat)
  const longitude = toNumber(first.lon)
  if (latitude === null || longitude === null) return null

  return { latitude, longitude }
}

export async function geocodeAddressServer(params: GeocodeLookupParams): Promise<GeocodeLookupResult> {
  const queries = buildGeocodeQueries(params)
  if (queries.length === 0) {
    throw new AddressLookupError(400, 'invalid_address', 'Informe ao menos cidade e UF para geocodificar')
  }

  const triedQueries: string[] = []
  for (let index = 0; index < queries.length; index += 1) {
    const candidate = queries[index]
    triedQueries.push(candidate.query)
    const result = await searchNominatim(candidate.query)
    if (!result) continue

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      precision: candidate.precision,
      query: candidate.query,
      fallbackUsed: index > 0,
      notFound: false,
      triedQueries,
    }
  }

  return {
    latitude: null,
    longitude: null,
    precision: null,
    query: null,
    fallbackUsed: false,
    notFound: true,
    triedQueries,
  }
}
