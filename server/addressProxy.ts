export class AddressLookupError extends Error {
  code: string
  status: number

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'AddressLookupError'
    this.code = code
    this.status = status
  }
}

interface ViaCepResponse {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

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

interface QueryCandidate {
  query: string
  boost: number
}

const MAX_QUERY_CANDIDATES = 6
const NOMINATIM_TIMEOUT_MS = 10000

export interface GeocodeAddressInput {
  address?: string | null
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
}

function sanitize(value: string | null | undefined): string {
  return (value || '').trim()
}

function normalizeCep(value: string | null | undefined): string {
  return sanitize(value).replace(/\D/g, '').slice(0, 8)
}

function formatCep(value: string | null | undefined): string {
  const digits = normalizeCep(value)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
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

function normalizeForMatch(value: string | null | undefined): string {
  return sanitize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeHouseNumber(value: string | null | undefined): string {
  return sanitize(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z/-]/g, '')
}

function buildQueryParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => sanitize(part))
    .filter(Boolean)
    .join(', ')
}

function expandStreetVariants(value: string): string[] {
  const base = sanitize(value)
  if (!base) return []

  const replacements = [
    base,
    base
      .replace(/\btv\.?\b/gi, 'travessa')
      .replace(/\btrav\.?\b/gi, 'travessa')
      .replace(/\br\.?\b/gi, 'rua')
      .replace(/\bav\.?\b/gi, 'avenida')
      .replace(/\bal\.?\b/gi, 'alameda'),
  ]

  return Array.from(new Set(replacements.map((entry) => sanitize(entry)).filter(Boolean)))
}

function buildQueryCandidates(input: GeocodeAddressInput): QueryCandidate[] {
  const address = sanitize(input.address)
  const street = sanitize(input.street)
  const number = sanitize(input.number)
  const neighborhood = sanitize(input.neighborhood)
  const city = sanitize(input.city)
  const state = sanitize(input.state).toUpperCase()
  const cep = formatCep(input.cep)
  const cityState = [city, state].filter(Boolean).join(' - ')

  const seen = new Set<string>()
  const candidates: QueryCandidate[] = []
  const baseStreetCandidates = expandStreetVariants(street || address)

  function pushCandidate(query: string, boost: number) {
    const normalized = sanitize(query)
    if (!normalized) return
    const dedupeKey = normalized.toLowerCase()
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    candidates.push({ query: normalized, boost })
  }

  for (const streetVariant of baseStreetCandidates) {
    const streetWithNumber = streetVariant && number ? `${streetVariant}, ${number}` : buildQueryParts([streetVariant, number])
    pushCandidate(buildQueryParts([streetWithNumber, neighborhood, cityState, cep, 'Brazil']), 10)
    pushCandidate(buildQueryParts([streetWithNumber, cityState, cep, 'Brazil']), 8)
    pushCandidate(buildQueryParts([streetWithNumber, cityState, 'Brazil']), 6)
  }

  if (address && address !== street) {
    pushCandidate(buildQueryParts([address, neighborhood, cityState, cep, 'Brazil']), 7)
    pushCandidate(buildQueryParts([address, cityState, cep, 'Brazil']), 5)
    pushCandidate(buildQueryParts([address, cityState, 'Brazil']), 4)
  }

  if (cep) {
    pushCandidate(buildQueryParts([`CEP ${cep}`, city, state, 'Brazil']), 2)
    pushCandidate(buildQueryParts([cep, city, state, 'Brazil']), 2)
  }

  pushCandidate(buildQueryParts([city, state, 'Brazil']), 1)
  return candidates.slice(0, MAX_QUERY_CANDIDATES)
}

function extractAddressCity(address?: NominatimAddress): string {
  if (!address) return ''
  return sanitize(address.city || address.town || address.village || address.municipality || '')
}

function scoreNominatimResult(result: NominatimResult, input: GeocodeAddressInput, boost: number): number {
  const address = result.address || {}
  const queryPostcode = normalizeCep(input.cep)
  const resultPostcode = normalizeCep(address.postcode)
  const queryNumber = normalizeHouseNumber(input.number)
  const resultNumber = normalizeHouseNumber(address.house_number)
  const queryStreet = normalizeForMatch(input.street || input.address)
  const resultStreet = normalizeForMatch(address.road)
  const queryCity = normalizeForMatch(input.city)
  const resultCity = normalizeForMatch(extractAddressCity(address))
  const queryState = normalizeForMatch(input.state)
  const resultState = normalizeForMatch(address.state)
  const importance = parseCoordinate(result.importance) || 0

  let score = importance * 20 + boost

  if (resultPostcode) score += 6
  if (queryPostcode && queryPostcode === resultPostcode) score += 18

  if (resultNumber) score += 6
  if (queryNumber && resultNumber && queryNumber === resultNumber) score += 24

  if (queryStreet && resultStreet) {
    if (queryStreet === resultStreet) score += 10
    else if (queryStreet.includes(resultStreet) || resultStreet.includes(queryStreet)) score += 4
  }

  if (queryCity && resultCity && queryCity === resultCity) score += 8
  if (queryState && resultState && queryState === resultState) score += 5

  return score
}

async function fetchNominatimResults(query: string): Promise<NominatimResult[]> {
  const endpoint =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=br&q=${encodeURIComponent(query)}`

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), NOMINATIM_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(endpoint, {
      signal: abortController.signal,
      headers: {
        'User-Agent': 'Barberage/1.0 (contact: suporte@barberage.app)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    })
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new AddressLookupError('geocode_timeout', 504, 'Tempo esgotado ao consultar geocodificacao.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new AddressLookupError('geocode_provider_unavailable', 502, 'Falha ao consultar o provedor de geocodificacao.')
  }

  const results = (await response.json()) as NominatimResult[]
  if (!Array.isArray(results)) return []
  return results
}

function resolvePrecision(result: NominatimResult): 'rooftop' | 'street' | 'postal_code' | 'city' {
  const hasNumber = Boolean(sanitize(result.address?.house_number))
  const hasPostcode = Boolean(normalizeCep(result.address?.postcode))
  if (hasNumber && hasPostcode) return 'rooftop'
  if (hasNumber) return 'street'
  if (hasPostcode) return 'postal_code'
  return 'city'
}

export async function lookupCepServer(cepInput: string) {
  const cep = normalizeCep(cepInput)
  if (cep.length !== 8) {
    throw new AddressLookupError('invalid_cep', 400, 'CEP invalido. Informe 8 digitos.')
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new AddressLookupError('cep_provider_unavailable', 502, 'Falha ao consultar o servico de CEP.')
  }

  const data = (await response.json()) as ViaCepResponse
  if (data?.erro) {
    throw new AddressLookupError('cep_not_found', 404, 'CEP nao encontrado.')
  }

  return {
    cep: formatCep(data.cep || cep),
    street: sanitize(data.logradouro),
    neighborhood: sanitize(data.bairro),
    city: sanitize(data.localidade),
    state: sanitize(data.uf).toUpperCase(),
  }
}

export async function geocodeAddressServer(input: GeocodeAddressInput) {
  const candidates = buildQueryCandidates(input)
  if (candidates.length === 0) {
    throw new AddressLookupError('invalid_address', 400, 'Endereco incompleto para geocodificacao.')
  }

  let bestMatch: { result: NominatimResult; query: string; score: number } | null = null

  for (const candidate of candidates) {
    const results = await fetchNominatimResults(candidate.query)
    if (!results.length) continue

    for (const result of results) {
      const latitude = parseCoordinate(result.lat)
      const longitude = parseCoordinate(result.lon)
      if (latitude === null || longitude === null) continue

      const score = scoreNominatimResult(result, input, candidate.boost)
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          result,
          query: candidate.query,
          score,
        }
      }
    }
  }

  if (!bestMatch) {
    throw new AddressLookupError('location_not_found', 422, 'Localizacao nao encontrada para o endereco informado.')
  }

  const bestResult = bestMatch.result
  const latitude = parseCoordinate(bestResult.lat)
  const longitude = parseCoordinate(bestResult.lon)

  if (latitude === null || longitude === null) {
    throw new AddressLookupError('invalid_provider_response', 502, 'Resposta de geocodificacao invalida.')
  }

  return {
    latitude,
    longitude,
    source: 'nominatim' as const,
    precision: resolvePrecision(bestResult),
    formatted_address: sanitize(bestResult.display_name) || bestMatch.query,
    query: bestMatch.query,
  }
}
