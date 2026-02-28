import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

interface GeocodePayload {
  shopId?: string
  cep?: string | null
  city?: string | null
  state?: string | null
  neighborhood?: string | null
  address_street?: string | null
  address_number?: string | null
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
  complement: string
}

interface QueryCandidate {
  query: string
  precision: 'exact' | 'street' | 'neighborhood' | 'postcode' | 'city'
}

const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://barber-age.vercel.app']

const baseCorsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function resolveCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
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

function mergeFields(payload: GeocodePayload, source?: Partial<LocationFields> | null): LocationFields {
  return {
    cep: normalizeCep(payload.cep ?? source?.cep ?? ''),
    city: sanitize(payload.city ?? source?.city ?? ''),
    state: sanitize(payload.state ?? source?.state ?? '').toUpperCase(),
    neighborhood: sanitize(payload.neighborhood ?? source?.neighborhood ?? ''),
    address_street: sanitize(payload.address_street ?? source?.address_street ?? ''),
    address_number: sanitize(payload.address_number ?? source?.address_number ?? ''),
    complement: sanitize(payload.complement ?? source?.complement ?? ''),
  }
}

function buildQueryParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => sanitize(part))
    .filter(Boolean)
    .join(', ')
}

function buildQueryCandidates(fields: LocationFields): QueryCandidate[] {
  const candidates: QueryCandidate[] = []
  const seen = new Set<string>()
  const cep = formatCep(fields.cep)
  const streetWithNumber = buildQueryParts([fields.address_street, fields.address_number])

  function push(precision: QueryCandidate['precision'], parts: Array<string | null | undefined>) {
    const query = buildQueryParts([...parts, 'Brasil'])
    if (!query || seen.has(query)) return
    seen.add(query)
    candidates.push({ query, precision })
  }

  push('exact', [streetWithNumber, fields.neighborhood, fields.city, fields.state, cep])
  push('street', [streetWithNumber, fields.city, fields.state, cep])
  push('street', [fields.address_street, fields.city, fields.state, cep])
  push('neighborhood', [fields.neighborhood, fields.city, fields.state, cep])
  push('postcode', [cep, fields.city, fields.state])
  push('city', [fields.city, fields.state])

  return candidates
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
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function persistCoordinates(
  supabase: ReturnType<typeof createClient>,
  shopId: string,
  latitude: number,
  longitude: number
) {
  const primary = await supabase
    .from('shops')
    .update({ latitude, longitude })
    .eq('id', shopId)

  if (!primary.error) return

  await supabase
    .from('barbershops')
    .update({ latitude, longitude })
    .eq('id', shopId)
}

async function fetchNominatimResult(query: string) {
  const endpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`
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
  return Array.isArray(geocodeData) ? geocodeData[0] : null
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
        .select('cep, city, state, neighborhood, address_street, address_number, complement')
        .eq('id', shopId)
        .maybeSingle()

      if (shopRes.data) {
        sourceFields = shopRes.data
      } else {
        const compatibilityRes = await supabase
          .from('barbershops')
          .select('cep, city, state, neighborhood, address_street, address_number, complement')
          .eq('id', shopId)
          .maybeSingle()
        sourceFields = compatibilityRes.data || null
      }
    }

    const fields = mergeFields(payload, sourceFields)

    if (!hasMinimumAddress(fields)) {
      return json(req, { error: 'Address is incomplete for geocoding' }, 400)
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

    for (const candidate of queryCandidates) {
      const queryHash = await sha256(candidate.query.toLowerCase())
      const cachedRes = await supabase
        .from('geocode_cache')
        .select('latitude, longitude, updated_at')
        .eq('query_hash', queryHash)
        .maybeSingle()

      const cachedLat = parseCoordinate(cachedRes.data?.latitude)
      const cachedLng = parseCoordinate(cachedRes.data?.longitude)

      if (cachedLat === null || cachedLng === null) continue

      if (persist) {
        await persistCoordinates(supabase, shopId, cachedLat, cachedLng)
      }

      return json(req, {
        latitude: cachedLat,
        longitude: cachedLng,
        source: 'cache',
        precision: candidate.precision,
        persisted: persist,
        query: candidate.query,
      })
    }

    for (let index = 0; index < queryCandidates.length; index += 1) {
      const candidate = queryCandidates[index]
      if (index > 0) {
        await wait(1100)
      }

      let topResult: Record<string, unknown> | null = null
      try {
        topResult = await fetchNominatimResult(candidate.query)
      } catch {
        return json(req, { error: 'Nominatim request failed' }, 502)
      }

      if (!topResult?.lat || !topResult?.lon) {
        continue
      }

      const latitude = Number.parseFloat(String(topResult.lat))
      const longitude = Number.parseFloat(String(topResult.lon))

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue
      }

      const queryHash = await sha256(candidate.query.toLowerCase())
      await supabase
        .from('geocode_cache')
        .upsert(
          {
            query_hash: queryHash,
            query_text: candidate.query,
            latitude,
            longitude,
            provider: 'nominatim',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'query_hash' }
        )

      if (persist) {
        await persistCoordinates(supabase, shopId, latitude, longitude)
      }

      return json(req, {
        latitude,
        longitude,
        source: 'nominatim',
        precision: candidate.precision,
        persisted: persist,
        query: candidate.query,
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
