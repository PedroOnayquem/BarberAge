import { parseCep } from './location'

export interface CepLookupResponse {
  cep: string
  logradouro: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface GeocodeLookupResponse {
  latitude: number | null
  longitude: number | null
  precision: 'address' | 'district' | 'city' | 'cep' | null
  query: string | null
  fallbackUsed: boolean
  notFound: boolean
  triedQueries: string[]
}

export type LocationApiErrorCode =
  | 'invalid_cep'
  | 'not_found'
  | 'timeout'
  | 'network_error'
  | 'server_error'
  | 'invalid_address'
  | 'unknown'

export class LocationApiError extends Error {
  readonly code: LocationApiErrorCode
  readonly status: number | null

  constructor(code: LocationApiErrorCode, message: string, status: number | null = null) {
    super(message)
    this.name = 'LocationApiError'
    this.code = code
    this.status = status
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      const payloadObj = (payload || {}) as { error?: string; message?: string }
      const errorCode = payloadObj.error || 'server_error'
      const message = payloadObj.message || 'Falha na consulta de localizacao'
      throw new LocationApiError(errorCode as LocationApiErrorCode, message, response.status)
    }

    return payload
  } catch (error) {
    if (error instanceof LocationApiError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LocationApiError('timeout', 'Consulta de localizacao excedeu o tempo limite.')
    }
    throw new LocationApiError('network_error', 'Falha de rede ao consultar localizacao.')
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function lookupCep(cepRaw: string): Promise<CepLookupResponse> {
  const cep = parseCep(cepRaw)
  if (cep.length !== 8) {
    throw new LocationApiError('invalid_cep', 'CEP deve conter 8 digitos.')
  }

  const payload = (await fetchJsonWithTimeout(`/api/cep?cep=${encodeURIComponent(cep)}`)) as Partial<CepLookupResponse>
  if (payload.erro) {
    throw new LocationApiError('not_found', 'CEP nao encontrado.')
  }

  return {
    cep: typeof payload.cep === 'string' ? payload.cep : cep,
    logradouro: typeof payload.logradouro === 'string' ? payload.logradouro : '',
    bairro: typeof payload.bairro === 'string' ? payload.bairro : '',
    localidade: typeof payload.localidade === 'string' ? payload.localidade : '',
    uf: typeof payload.uf === 'string' ? payload.uf : '',
  }
}

export async function geocodeAddress(params: {
  address?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  cep?: string
}): Promise<GeocodeLookupResponse> {
  const query = new URLSearchParams()
  if (params.address?.trim()) query.set('address', params.address.trim())
  if (params.street?.trim()) query.set('street', params.street.trim())
  if (params.number?.trim()) query.set('number', params.number.trim())
  if (params.neighborhood?.trim()) query.set('neighborhood', params.neighborhood.trim())
  if (params.city?.trim()) query.set('city', params.city.trim())
  if (params.state?.trim()) query.set('state', params.state.trim().toUpperCase())
  if (params.cep?.trim()) query.set('cep', parseCep(params.cep))

  if (![...query.keys()].length) {
    throw new LocationApiError('invalid_address', 'Informe endereco para geocodificar.')
  }

  const payload = (await fetchJsonWithTimeout(`/api/geocode?${query.toString()}`, 10000)) as Partial<GeocodeLookupResponse>

  const latitude = typeof payload.latitude === 'number' && Number.isFinite(payload.latitude) ? payload.latitude : null
  const longitude = typeof payload.longitude === 'number' && Number.isFinite(payload.longitude) ? payload.longitude : null

  return {
    latitude,
    longitude,
    precision: payload.precision || null,
    query: payload.query || null,
    fallbackUsed: Boolean(payload.fallbackUsed),
    notFound: Boolean(payload.notFound),
    triedQueries: Array.isArray(payload.triedQueries) ? payload.triedQueries.filter((q): q is string => typeof q === 'string') : [],
  }
}
