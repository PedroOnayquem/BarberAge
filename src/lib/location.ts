export interface LocationFields {
  cep?: string | null
  address_street?: string | null
  address_number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  complement?: string | null
  address?: string | null
}

export type GeocodePrecision = 'rooftop' | 'street' | 'postal_code' | 'city'

export function parseCep(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '').slice(0, 8)
}

export function normalizeCep(value: string | null | undefined) {
  return parseCep(value)
}

export function formatCep(value: string | null | undefined) {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function buildAddressLine(fields: LocationFields) {
  const street = (fields.address_street || '').trim()
  const number = (fields.address_number || '').trim()
  const neighborhood = (fields.neighborhood || '').trim()

  const parts = [
    street && number ? `${street}, ${number}` : street || number || '',
    neighborhood,
  ].filter(Boolean)

  return parts.join(', ')
}

export function buildFullAddress(fields: LocationFields) {
  const streetLine = buildAddressLine(fields)
  const complement = (fields.complement || '').trim()
  const city = (fields.city || '').trim()
  const state = (fields.state || '').trim().toUpperCase()
  const cep = formatCep(fields.cep)
  const cityState = [city, state].filter(Boolean).join(' - ')

  return [streetLine, complement, cityState, cep].filter(Boolean).join(', ')
}

export function buildReadableAddress(fields: LocationFields) {
  const baseLine = buildAddressLine(fields)
  const complement = (fields.complement || '').trim()
  const city = (fields.city || '').trim()
  const state = (fields.state || '').trim().toUpperCase()
  const cep = formatCep(fields.cep)
  const cityState = [city, state].filter(Boolean).join(' - ')

  const parts = [
    baseLine,
    complement,
    cityState,
    cep ? `CEP ${cep}` : '',
  ].filter(Boolean)

  return parts.join(' • ') || (fields.address || '').trim() || 'Endereço não informado'
}

export function buildGeocodingQuery(fields: LocationFields) {
  const street = (fields.address_street || '').trim()
  const number = (fields.address_number || '').trim()
  const neighborhood = (fields.neighborhood || '').trim()
  const city = (fields.city || '').trim()
  const state = (fields.state || '').trim().toUpperCase()
  const cep = formatCep(fields.cep)

  const streetLine = street && number ? `${street}, ${number}` : street || number || ''
  const cityState = [city, state].filter(Boolean).join('-')

  return [
    streetLine,
    neighborhood,
    cityState,
    cep,
    'Brasil',
  ].filter(Boolean).join(', ')
}

export function buildAddressSignature(fields: LocationFields) {
  return [
    normalizeCep(fields.cep),
    (fields.address_street || '').trim().toLowerCase(),
    (fields.address_number || '').trim().toLowerCase(),
    (fields.neighborhood || '').trim().toLowerCase(),
    (fields.city || '').trim().toLowerCase(),
    (fields.state || '').trim().toUpperCase(),
    (fields.complement || '').trim().toLowerCase(),
  ].join('|')
}

export function hasMinimumAddressForGeocoding(fields: LocationFields) {
  return Boolean(
    normalizeCep(fields.cep) &&
    (fields.address_street || '').trim() &&
    (fields.address_number || '').trim() &&
    (fields.city || '').trim() &&
    (fields.state || '').trim()
  )
}

export interface NormalizedCoordinates {
  latitude: number
  longitude: number
  wasSwapped: boolean
}

export function normalizeGeocodePrecision(value: unknown): GeocodePrecision | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'rooftop' || normalized === 'street' || normalized === 'postal_code' || normalized === 'city') {
    return normalized
  }
  return null
}

export function getLocationPreviewZoom(precisionLike: unknown) {
  const precision = normalizeGeocodePrecision(precisionLike)
  if (precision === 'rooftop') return 17
  if (precision === 'street') return 16
  if (precision === 'postal_code') return 15
  if (precision === 'city') return 13
  return 16
}

export function formatGeocodeProviderLabel(providerLike: unknown) {
  if (typeof providerLike !== 'string') return ''
  const normalized = providerLike.trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'nominatim') return 'Nominatim'
  if (normalized === 'manual' || normalized === 'manual_map') return 'Mapa confirmado manualmente'
  return providerLike.trim()
}

export function formatLocationPrecisionLabel(precisionLike: unknown, providerLike?: unknown) {
  const provider = typeof providerLike === 'string' ? providerLike.trim().toLowerCase() : ''
  if (provider === 'manual' || provider === 'manual_map') {
    return 'Ponto confirmado manualmente no mapa'
  }

  const precision = normalizeGeocodePrecision(precisionLike)
  if (precision === 'rooftop') return 'Precisão alta: número/local exato'
  if (precision === 'street') return 'Precisão boa: rua confirmada'
  if (precision === 'postal_code') return 'Precisão média: centrado por CEP'
  if (precision === 'city') return 'Precisão baixa: centrado por cidade'
  return 'Coordenadas disponíveis'
}

export function parseCoordinateNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function ensureNumber(value: unknown) {
  return parseCoordinateNumber(value)
}

export function isLatitudeInRange(value: number) {
  return value >= -90 && value <= 90
}

export function isLongitudeInRange(value: number) {
  return value >= -180 && value <= 180
}

export function normalizeAndRepairCoordinates(
  latitudeLike: unknown,
  longitudeLike: unknown
): NormalizedCoordinates | null {
  const latitude = parseCoordinateNumber(latitudeLike)
  const longitude = parseCoordinateNumber(longitudeLike)
  if (latitude === null || longitude === null) return null

  if (latitude === 0 && longitude === 0) return null

  const latitudeIsValid = isLatitudeInRange(latitude)
  const longitudeIsValid = isLongitudeInRange(longitude)
  if (latitudeIsValid && longitudeIsValid) {
    return { latitude, longitude, wasSwapped: false }
  }

  const canSwap = isLatitudeInRange(longitude) && isLongitudeInRange(latitude)
  if (canSwap) {
    return { latitude: longitude, longitude: latitude, wasSwapped: true }
  }

  return null
}
