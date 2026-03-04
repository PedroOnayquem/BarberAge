import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

interface GeocodePayload {
  shopId?: string
  cep?: string | null
  city?: string | null
  state?: string | null
  neighborhood?: string | null
  address_street?: string | null
  address_number?: string | null
  address?: string | null
  complement?: string | null
  persist?: boolean
}

interface LocationFields {
  cep: string
  city: string
  state: string
  neighborhood: string
  address_street: string
  address_number: string
  address: string
  complement: string
}

interface QueryCandidate {
  query: string
}

interface NormalizedCoordinates {
  latitude: number
  longitude: number
  wasSwapped: boolean
}

type GeocodePrecision = 'rooftop' | 'street' | 'postal_code' | 'city'

interface NominatimAddress {
  house_number?: string
  road?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  state?: string
}

interface NominatimResult {
  lat?: string | number
  lon?: string | number
  importance?: string | number
  display_name?: string
  address?: NominatimAddress
}

const STATIC_ALLOWED_ORIGINS = ['https://barber-age.vercel.app']

function getAllowedOriginsFromEnv() {
  const envOrigins = (Deno.env.get('CORS_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return Array.from(new Set([...STATIC_ALLOWED_ORIGINS, ...envOrigins]))
}

function isLocalDevOrigin(origin: string) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
}

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function resolveCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowedOrigins = getAllowedOriginsFromEnv()
  const allowOrigin =
    origin && (isLocalDevOrigin(origin) || allowedOrigins.includes(origin))
      ? origin
      : allowedOrigins[0] || 'https://barber-age.vercel.app'

  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...resolveCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  })
}

function normalizeCep(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '').slice(0, 8)
}

function formatCep(value: string | null | undefined) {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function sanitize(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeForMatch(value: string | null | undefined) {
  return sanitize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeHouseNumber(value: string | null | undefined) {
  return sanitize(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z/-]/g, '')
}

function mergeFields(payload: GeocodePayload, source?: Partial<LocationFields> | null): LocationFields {
  const normalizedStreet = sanitize(payload.address_street ?? source?.address_street ?? '')
  const normalizedNumber = sanitize(payload.address_number ?? source?.address_number ?? '')
  const normalizedAddress = sanitize(payload.address ?? source?.address ?? '')

  return {
    cep: normalizeCep(payload.cep ?? source?.cep ?? ''),
    city: sanitize(payload.city ?? source?.city ?? ''),
    state: sanitize(payload.state ?? source?.state ?? '').toUpperCase(),
    neighborhood: sanitize(payload.neighborhood ?? source?.neighborhood ?? ''),
    address_street: normalizedStreet,
    address_number: normalizedNumber,
    address: normalizedAddress,
    complement: sanitize(payload.complement ?? source?.complement ?? ''),
  }
}

function buildQueryParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => sanitize(part))
    .filter(Boolean)
    .join(', ')
}

function buildFullAddressQuery(fields: LocationFields) {
  const street = sanitize(fields.address_street)
  const number = sanitize(fields.address_number)
  const neighborhood = sanitize(fields.neighborhood)
  const city = sanitize(fields.city)
  const state = sanitize(fields.state).toUpperCase()
  const cep = formatCep(fields.cep)

  const streetWithNumber = street && number ? `${street}, ${number}` : buildQueryParts([street, number])
  const streetBlock = neighborhood ? `${streetWithNumber} - ${neighborhood}` : streetWithNumber
  const cityStateBlock = [city, state].filter(Boolean).join(' - ')

  return buildQueryParts([streetBlock, cityStateBlock, cep, 'Brazil'])
}

function buildQueryCandidates(fields: LocationFields): QueryCandidate[] {
  const query = buildFullAddressQuery(fields)
  if (!query) return []
  return [{ query }]
}

function hasMinimumAddress(fields: LocationFields) {
  return Boolean(
    fields.cep &&
    fields.address_street &&
    fields.address_number &&
    fields.city &&
    fields.state
  )
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isLatitudeInRange(value: number) {
  return value >= -90 && value <= 90
}

function isLongitudeInRange(value: number) {
  return value >= -180 && value <= 180
}

function normalizeCoordinates(latitudeLike: unknown, longitudeLike: unknown): NormalizedCoordinates | null {
  const latitude = parseCoordinate(latitudeLike)
  const longitude = parseCoordinate(longitudeLike)
  if (latitude === null || longitude === null) return null
  if (latitude === 0 && longitude === 0) return null

  if (isLatitudeInRange(latitude) && isLongitudeInRange(longitude)) {
    return { latitude, longitude, wasSwapped: false }
  }

  if (isLatitudeInRange(longitude) && isLongitudeInRange(latitude)) {
    return { latitude: longitude, longitude: latitude, wasSwapped: true }
  }

  return null
}

function extractAddressCity(address?: NominatimAddress) {
  if (!address) return ''
  return sanitize(address.city || address.town || address.village || address.municipality || '')
}

function scoreNominatimResult(result: NominatimResult, fields: LocationFields) {
  const address = result.address || {}
  const queryPostcode = normalizeCep(fields.cep)
  const resultPostcode = normalizeCep(address.postcode)
  const queryNumber = normalizeHouseNumber(fields.address_number)
  const resultNumber = normalizeHouseNumber(address.house_number)
  const queryStreet = normalizeForMatch(fields.address_street)
  const resultStreet = normalizeForMatch(address.road)
  const queryCity = normalizeForMatch(fields.city)
  const resultCity = normalizeForMatch(extractAddressCity(address))
  const importance = parseCoordinate(result.importance) || 0

  let score = importance * 20

  if (resultPostcode) score += 6
  if (queryPostcode && resultPostcode === queryPostcode) score += 16

  if (resultNumber) score += 6
  if (queryNumber && resultNumber && queryNumber === resultNumber) score += 20

  if (queryStreet && resultStreet) {
    if (queryStreet === resultStreet) score += 10
    else if (queryStreet.includes(resultStreet) || resultStreet.includes(queryStreet)) score += 4
  }

  if (queryCity && resultCity && queryCity === resultCity) score += 6

  return score
}

function pickBestNominatimResult(results: NominatimResult[], fields: LocationFields) {
  if (!results.length) return null

  const scored = results.map((result, index) => ({
    result,
    index,
    score: scoreNominatimResult(result, fields),
  }))

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.index - b.index
  })

  return scored[0]?.result || null
}

function resolvePrecision(result: NominatimResult): GeocodePrecision {
  const address = result.address || {}
  const hasPostcode = Boolean(normalizeCep(address.postcode))
  const hasHouseNumber = Boolean(sanitize(address.house_number))

  if (hasHouseNumber && hasPostcode) return 'rooftop'
  if (hasHouseNumber) return 'street'
  if (hasPostcode) return 'postal_code'
  return 'city'
}

function resolveFormattedAddress(result: NominatimResult, query: string) {
  return sanitize(result.display_name) || query
}

function isSchemaCompatibilityError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('schema cache') ||
    normalized.includes('does not exist') ||
    normalized.includes('column') ||
    normalized.includes('pgrst204')
  )
}

async function persistToRelation(
  supabase: ReturnType<typeof createClient>,
  relation: 'shops' | 'barbershops',
  shopId: string,
  payload: Record<string, unknown>,
  tolerateErrors: boolean
) {
  const { error } = await supabase
    .from(relation)
    .update(payload)
    .eq('id', shopId)

  if (!error) return

  if (isSchemaCompatibilityError(error.message || '')) {
    const { error: fallbackError } = await supabase
      .from(relation)
      .update({
        latitude: payload.latitude as number,
        longitude: payload.longitude as number,
      })
      .eq('id', shopId)

    if (!fallbackError || tolerateErrors) return
    throw fallbackError
  }

  if (!tolerateErrors) throw error
}

async function persistCoordinates(
  supabase: ReturnType<typeof createClient>,
  shopId: string,
  coordinates: NormalizedCoordinates,
  metadata: {
    geocodedAt: string
    geocodePrecision: GeocodePrecision
    geocodeProvider: string
    formattedAddress: string
  }
) {
  const updatePayload = {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    geocoded_at: metadata.geocodedAt,
    geocode_precision: metadata.geocodePrecision,
    geocode_provider: metadata.geocodeProvider,
    formatted_address: metadata.formattedAddress,
  }

  await persistToRelation(supabase, 'shops', shopId, updatePayload, false)
  await persistToRelation(supabase, 'barbershops', shopId, updatePayload, true)
}

async function fetchNominatimResults(query: string): Promise<NominatimResult[]> {
  const endpoint =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(query)}`

  const geocodeResponse = await fetch(endpoint, {
    headers: {
      'User-Agent': 'Barberage/1.0 (contact: suporte@barberage.app)',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  })

  if (!geocodeResponse.ok) {
    throw new Error(`Nominatim request failed with status ${geocodeResponse.status}`)
  }

  const geocodeData = await geocodeResponse.json()
  if (!Array.isArray(geocodeData)) return []
  return geocodeData as NominatimResult[]
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        status: 200,
        headers: resolveCorsHeaders(req),
      })
    }

    if (req.method !== 'POST') {
      return json(req, { error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, { error: 'Missing Supabase env vars' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let payload: GeocodePayload
    try {
      payload = (await req.json()) as GeocodePayload
    } catch {
      return json(req, { error: 'Invalid JSON body' }, 400)
    }

    const shopId = sanitize(payload.shopId)
    const persist = Boolean(payload.persist && shopId)

    let userId: string | null = null
    if (persist) {
      const authHeader = req.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null

      if (!token) {
        return json(req, { error: 'Unauthorized' }, 401)
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(token)
      if (userError || !userData.user?.id) {
        return json(req, { error: 'Unauthorized' }, 401)
      }
      userId = userData.user.id
    }

    let sourceFields: Partial<LocationFields> | null = null

    if (shopId) {
      const shopRes = await supabase
        .from('shops')
        .select('cep, city, state, neighborhood, address_street, address_number, address, complement')
        .eq('id', shopId)
        .maybeSingle()

      if (shopRes.data) {
        sourceFields = shopRes.data
      } else {
        const compatibilityRes = await supabase
          .from('barbershops')
          .select('cep, city, state, neighborhood, address_street, address_number, address, complement')
          .eq('id', shopId)
          .maybeSingle()
        sourceFields = compatibilityRes.data || null
      }
    }

    const fields = mergeFields(payload, sourceFields)

    if (!hasMinimumAddress(fields)) {
      return json(
        req,
        { error: 'Address is incomplete for geocoding. Informe CEP e número para precisão.' },
        400
      )
    }

    if (persist) {
      const { data: membership, error: membershipError } = await supabase
        .from('shop_members')
        .select('id')
        .eq('shop_id', shopId)
        .eq('user_id', userId!)
        .limit(1)
        .maybeSingle()

      if (membershipError || !membership) {
        return json(req, { error: 'Forbidden' }, 403)
      }
    }

    const queryCandidates = buildQueryCandidates(fields)
    if (!queryCandidates.length) {
      return json(req, { error: 'Address is incomplete for geocoding. Informe CEP e número para precisão.' }, 400)
    }

    for (const candidate of queryCandidates) {
      const queryHash = await sha256(candidate.query.toLowerCase())
      const cachedRes = await supabase
        .from('geocode_cache')
        .select('latitude, longitude, updated_at, provider, geocode_precision, formatted_address, query_text')
        .eq('query_hash', queryHash)
        .maybeSingle()

      const cachedCoords = normalizeCoordinates(cachedRes.data?.latitude, cachedRes.data?.longitude)
      if (!cachedCoords) continue
      if (cachedCoords.wasSwapped) {
        console.warn('[geocode-shop-location] swapped cached coordinates corrected', {
          shopId: shopId || null,
          query: candidate.query,
          latitude: cachedRes.data?.latitude ?? null,
          longitude: cachedRes.data?.longitude ?? null,
          corrected_latitude: cachedCoords.latitude,
          corrected_longitude: cachedCoords.longitude,
        })
      }

      const cachedPrecisionCandidate = sanitize(cachedRes.data?.geocode_precision as string | undefined).toLowerCase()
      const cachedPrecision = (
        ['rooftop', 'street', 'postal_code', 'city'].includes(cachedPrecisionCandidate)
          ? cachedPrecisionCandidate
          : 'street'
      ) as GeocodePrecision
      const cachedProvider = sanitize(cachedRes.data?.provider as string | undefined) || 'nominatim'
      const formattedAddress =
        sanitize(cachedRes.data?.formatted_address as string | undefined) ||
        sanitize(cachedRes.data?.query_text as string | undefined) ||
        candidate.query
      const geocodedAt = new Date().toISOString()

      if (persist) {
        await persistCoordinates(supabase, shopId, cachedCoords, {
          geocodedAt,
          geocodePrecision: cachedPrecision,
          geocodeProvider: cachedProvider,
          formattedAddress,
        })
      }

      return json(req, {
        latitude: cachedCoords.latitude,
        longitude: cachedCoords.longitude,
        source: 'cache',
        precision: cachedPrecision,
        geocode_provider: cachedProvider,
        geocoded_at: geocodedAt,
        formatted_address: formattedAddress,
        persisted: persist,
        query: candidate.query,
        corrected_swapped_coordinates: cachedCoords.wasSwapped,
      })
    }

    for (let index = 0; index < queryCandidates.length; index += 1) {
      const candidate = queryCandidates[index]
      if (index > 0) {
        await wait(1100)
      }

      let results: NominatimResult[] = []
      try {
        results = await fetchNominatimResults(candidate.query)
      } catch {
        return json(req, { error: 'Nominatim request failed' }, 502)
      }

      const bestResult = pickBestNominatimResult(results, fields)
      if (!bestResult?.lat || !bestResult?.lon) {
        continue
      }

      const normalizedCoords = normalizeCoordinates(bestResult.lat, bestResult.lon)
      if (!normalizedCoords) {
        continue
      }
      if (normalizedCoords.wasSwapped) {
        console.warn('[geocode-shop-location] swapped nominatim coordinates corrected', {
          shopId: shopId || null,
          query: candidate.query,
          lat: bestResult.lat ?? null,
          lon: bestResult.lon ?? null,
          corrected_latitude: normalizedCoords.latitude,
          corrected_longitude: normalizedCoords.longitude,
        })
      }

      const geocodePrecision = resolvePrecision(bestResult)
      const formattedAddress = resolveFormattedAddress(bestResult, candidate.query)
      const geocodeProvider = 'nominatim'
      const geocodedAt = new Date().toISOString()

      const queryHash = await sha256(candidate.query.toLowerCase())
      await supabase
        .from('geocode_cache')
        .upsert(
          {
            query_hash: queryHash,
            query_text: candidate.query,
            latitude: normalizedCoords.latitude,
            longitude: normalizedCoords.longitude,
            provider: geocodeProvider,
            geocode_precision: geocodePrecision,
            formatted_address: formattedAddress,
            updated_at: geocodedAt,
          },
          { onConflict: 'query_hash' }
        )

      if (persist) {
        await persistCoordinates(supabase, shopId, normalizedCoords, {
          geocodedAt,
          geocodePrecision,
          geocodeProvider,
          formattedAddress,
        })
      }

      return json(req, {
        latitude: normalizedCoords.latitude,
        longitude: normalizedCoords.longitude,
        source: 'nominatim',
        precision: geocodePrecision,
        geocode_provider: geocodeProvider,
        geocoded_at: geocodedAt,
        formatted_address: formattedAddress,
        persisted: persist,
        query: candidate.query,
        corrected_swapped_coordinates: normalizedCoords.wasSwapped,
      })
    }

    return json(
      req,
      {
        error: 'Location not found',
        attempted_queries: queryCandidates.map((candidate) => candidate.query),
      },
      422
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json(req, { error: 'Internal server error', details: message }, 500)
  }
})
