import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Scissors, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import { Select } from '../../components/ui/Select'
import type { Database } from '../../types/database'

type PublicBarbershopStatus =
  Database['public']['Functions']['list_public_barbershops_with_status']['Returns'][number]
type FilteredPublicBarbershopStatus =
  Database['public']['Functions']['list_public_barbershops_with_status_filtered']['Returns'][number]

type ShopCard = FilteredPublicBarbershopStatus & {
  description: string
  statusLabel: string
  reason: string
  isPreferred: boolean
  avatarSignedUrl: string | null
}

type CityOption = {
  city: string
  state: string | null
}

const SEARCH_DEBOUNCE_MS = 300

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function formatLocation(shop: Pick<ShopCard, 'address' | 'neighborhood' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, shop.neighborhood, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

function matchesFilters(shop: Pick<ShopCard, 'city' | 'state'>, cityFilter: string, stateFilter: string) {
  const cityNormalized = normalize(cityFilter)
  const stateNormalized = normalize(stateFilter)

  const matchesCity = !cityNormalized || normalize(shop.city).includes(cityNormalized)
  const matchesState = !stateNormalized || normalize(shop.state) === stateNormalized

  return matchesCity && matchesState
}

export function ClientBarbershopsPage() {
  const { clientShop } = useAuth()
  const [shops, setShops] = useState<ShopCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [debouncedCityFilter, setDebouncedCityFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [stateOptions, setStateOptions] = useState<string[]>([])

  useEffect(() => {
    loadFilterOptions()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedCityFilter(cityFilter.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [cityFilter])

  useEffect(() => {
    loadShops({ city: debouncedCityFilter, state: stateFilter })
  }, [debouncedCityFilter, stateFilter, clientShop?.id])

  function getShopCatalogStatus(shop: FilteredPublicBarbershopStatus): { label: string; canBook: boolean; reason: string } {
    const canBook = !!shop.can_book
    const reason = canBook
      ? ''
      : (shop.missing_reasons || []).filter(Boolean).join(' · ') || 'Catálogo em configuração.'

    return {
      label: canBook ? 'agenda ok' : 'agenda pendente',
      canBook,
      reason,
    }
  }

  async function loadFilterOptions() {
    let sourceRows: Array<{ city: string | null; state: string | null }> = []
    if (import.meta.env.DEV) {
      console.log('[marketplace-filters] query', {
        source: "supabase.from('barbershops').select('city,state')",
      })
    }

    const { data: relationRows, error: relationError } = await supabase
      .from('barbershops')
      .select('city, state')
      .order('state', { ascending: true })
      .order('city', { ascending: true })

    if (import.meta.env.DEV) {
      console.log('[marketplace-filters] result', {
        source: 'barbershops',
        error: relationError,
        count: relationRows?.length ?? 0,
      })
    }

    if (!relationError && relationRows) {
      sourceRows = relationRows.map((row) => ({
        city: row.city || null,
        state: row.state || null,
      }))
    } else {
      const { data: baseRows, error: baseError } = await supabase.rpc('list_public_barbershops_with_status')
      if (baseError || !baseRows) return
      sourceRows = (baseRows as PublicBarbershopStatus[]).map((row) => ({
        city: row.city || null,
        state: row.state || null,
      }))

      if (import.meta.env.DEV) {
        console.log('[marketplace-filters] fallback-result', {
          source: "rpc('list_public_barbershops_with_status')",
          error: baseError,
          count: sourceRows.length,
        })
      }
    }

    const cityPairs = new Map<string, CityOption>()
    const states = new Set<string>()

    sourceRows.forEach((row) => {
      const city = row.city?.trim() || ''
      const state = row.state?.trim().toUpperCase() || null

      if (city) {
        const key = `${city}|${state || ''}`.toLowerCase()
        cityPairs.set(key, { city, state })
      }
      if (state) states.add(state)
    })

    const normalizedCities = Array.from(cityPairs.values()).sort((a, b) => {
      const left = `${a.city} ${a.state || ''}`.trim()
      const right = `${b.city} ${b.state || ''}`.trim()
      return left.localeCompare(right, 'pt-BR')
    })

    if (import.meta.env.DEV) {
      console.log('[marketplace-filters] processed', {
        cities: normalizedCities.length,
        states: states.size,
      })
    }

    setCityOptions(normalizedCities)
    setStateOptions(Array.from(states).sort((a, b) => a.localeCompare(b, 'pt-BR')))
  }

  async function buildCards(rows: FilteredPublicBarbershopStatus[], preferredShopId: string | null) {
    const deduped = Array.from(new Map(rows.map((shop) => [shop.id, shop])).values())

    return Promise.all(
      deduped.map(async (shop) => {
        const status = getShopCatalogStatus(shop)
        const avatarSignedUrl = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop.avatar_url)

        return {
          ...shop,
          avatarSignedUrl,
          statusLabel: status.label,
          reason: status.reason,
          can_book: status.canBook,
          isPreferred: preferredShopId === shop.id,
          description: 'Atendimento profissional com agendamento online e horários flexíveis.',
        } satisfies ShopCard
      })
    )
  }

  async function loadShops(filters: { city: string; state: string }) {
    setLoading(true)
    setError('')

    const preferredShopId =
      localStorage.getItem('barberage_client_preferred_shop') || clientShop?.id || null

    const { data: filteredRows, error: filteredError } = await supabase.rpc(
      'list_public_barbershops_with_status_filtered',
      {
        p_city: filters.city || null,
        p_state: filters.state || null,
      }
    )

    if (import.meta.env.DEV) {
      console.log('[marketplace-list] query', {
        rpc: 'list_public_barbershops_with_status_filtered',
        filters,
        error: filteredError,
        count: filteredRows?.length ?? 0,
      })
    }

    if (filteredError) {
      const rpcMissing =
        filteredError.code === 'PGRST202' ||
        filteredError.message.includes('Could not find the function')

      if (import.meta.env.DEV) {
        console.error(
          '[marketplace] RPC list_public_barbershops_with_status_filtered indisponível. ' +
            'Aplique a migration supabase/migrations/20260227103000_add_shop_location_and_city_filter_rpc.sql.',
          filteredError
        )
      }

      const { data: baseRows, error: baseError } = await supabase.rpc('list_public_barbershops_with_status')

      if (!baseError && baseRows) {
        const locallyFiltered = (baseRows as PublicBarbershopStatus[])
          .map((row) => ({
            ...row,
            city: row.city || null,
            state: row.state || null,
            neighborhood: row.neighborhood || null,
          }))
          .filter((shop) => matchesFilters(shop, filters.city, filters.state)) as FilteredPublicBarbershopStatus[]

        const cards = await buildCards(locallyFiltered, preferredShopId)
        setShops(cards)
        setError('Filtro indisponível no momento. Exibindo resultado com fallback.')
        if (import.meta.env.DEV) {
          console.log('[marketplace-list] fallback-query', {
            rpc: 'list_public_barbershops_with_status',
            filters,
            baseCount: baseRows.length,
            filteredCount: locallyFiltered.length,
          })
        }
        setLoading(false)
        return
      }

      setShops([])
      setError(
        rpcMissing
          ? 'Filtro indisponível no momento. Não foi possível carregar a listagem.'
          : 'Não foi possível validar o catálogo agora. Tente novamente em instantes.'
      )
      setLoading(false)
      return
    }

    const cards = await buildCards((filteredRows || []) as FilteredPublicBarbershopStatus[], preferredShopId)
    setShops(cards)

    const hasAnyFilter = !!filters.city || !!filters.state
    if (!hasAnyFilter && cards.length > 0 && !cards.some((shop) => shop.can_book)) {
      setError('Nenhuma barbearia com catálogo ativo. Exibindo barbearias cadastradas em modo de configuração.')
    }

    setLoading(false)
  }

  function clearFilters() {
    setCityFilter('')
    setDebouncedCityFilter('')
    setStateFilter('')
  }

  const empty = useMemo(() => !loading && shops.length === 0, [loading, shops.length])
  const emptyMessage = useMemo(() => {
    const hasCity = !!debouncedCityFilter
    const hasState = !!stateFilter
    if (!hasCity && !hasState) return 'Nenhuma barbearia ativa encontrada.'

    const location = [debouncedCityFilter || null, stateFilter || null].filter(Boolean).join(' - ')
    return location
      ? `Nenhuma barbearia encontrada em ${location}.`
      : 'Nenhuma barbearia encontrada com os filtros informados.'
  }, [debouncedCityFilter, stateFilter])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Explorar barbearias</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Escolha uma barbearia para ver serviços e agendar.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-end">
          <div>
            <label htmlFor="city-filter" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Cidade
            </label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                id="city-filter"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                list="barberage-city-suggestions"
                placeholder="Buscar por cidade..."
                className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
              />
              <datalist id="barberage-city-suggestions">
                {cityOptions.map((cityOption) => (
                  <option
                    key={`${cityOption.city}-${cityOption.state || 'sem-uf'}`}
                    value={cityOption.city}
                    label={cityOption.state ? `${cityOption.city} - ${cityOption.state}` : cityOption.city}
                  />
                ))}
              </datalist>
            </div>
          </div>

          <Select label="UF" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">Todas</option>
            {stateOptions.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!cityFilter && !stateFilter}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={15} />
            Limpar filtros
          </button>
        </div>
        {!loading && cityOptions.length === 0 && stateOptions.length === 0 && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Nenhuma cidade cadastrada ainda. Preencha cidade/UF nas configurações da barbearia.
          </p>
        )}
      </section>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
        </div>
      )}

      {empty && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          {emptyMessage}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
          {error}
        </div>
      )}

      {!loading && shops.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {shops.map((shop) => (
            <article
              key={shop.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-[var(--shadow-card)]"
            >
              <div className="mb-4 flex items-center gap-3">
                {shop.avatarSignedUrl ? (
                  <img
                    src={shop.avatarSignedUrl}
                    alt={`Logo da ${shop.name}`}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-sm font-bold text-[var(--color-text)]">
                    {shop.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-[var(--color-text)]">{shop.name}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {shop.professionals_count} profissionais · {shop.services_count} serviços · {shop.statusLabel}
                  </p>
                </div>
                {shop.isPreferred && (
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text)]">
                    Sua barbearia
                  </span>
                )}
              </div>

              <p className="mb-2 text-sm text-[var(--color-text-muted)]">{shop.description}</p>
              <p className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <MapPin size={13} />
                {formatLocation(shop)}
              </p>

              {shop.can_book ? (
                <Link
                  to={`/cliente/barbearias/${shop.slug}`}
                  onClick={() => localStorage.setItem('barberage_client_preferred_shop', shop.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  <Scissors size={16} />
                  Agendar
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title={shop.reason}
                  className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)]"
                >
                  <Scissors size={16} />
                  Em configuração
                </button>
              )}
              {!shop.can_book && shop.reason && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{shop.reason}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
