import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, MapPin, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import {
  ALL_CATEGORIES_FILTER,
  DEFAULT_SERVICE_CATEGORIES,
  type MarketplaceCategoryFilter,
} from '../../lib/serviceCategories'
import { CategoryTabs } from '../../components/cliente/marketplace/CategoryTabs'
import type { Database } from '../../types/database'

type PublicBusinessRow =
  Database['public']['Functions']['list_public_service_businesses_with_status']['Returns'][number]
type LegacyPublicBusinessRow =
  Database['public']['Functions']['list_public_barbershops_with_status']['Returns'][number]

type ShopCard = PublicBusinessRow & {
  description: string
  serviceCount: number
  professionalCount: number
  avatarSignedUrl: string | null
}

function normalizeLegacyRow(shop: LegacyPublicBusinessRow): PublicBusinessRow {
  return {
    ...shop,
    category_slugs: ['barbershop'],
    category_names: ['Barbearia'],
    service_names: [],
  }
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function formatLocation(shop: Pick<ShopCard, 'address' | 'neighborhood' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, shop.neighborhood, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

export function BarbershopsPage() {
  const [shops, setShops] = useState<ShopCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategoryFilter>(ALL_CATEGORIES_FILTER)

  async function loadShops() {
    setLoading(true)
    setError('')

    const { data: primaryRows, error: primaryError } = await supabase.rpc(
      'list_public_service_businesses_with_status_filtered',
      { p_search: null, p_category_slug: null, p_city: null, p_state: null }
    )

    let rows = (primaryRows || []) as PublicBusinessRow[]
    if (primaryError) {
      const { data: fallbackRows, error: fallbackError } = await supabase.rpc('list_public_barbershops_with_status')
      if (fallbackError || !fallbackRows) {
        if (import.meta.env.DEV) {
          console.error('[public-businesses] marketplace load error', {
            primaryError,
            fallbackError,
          })
        }
        setShops([])
        setError('Não foi possível carregar as empresas. Verifique as políticas de leitura do marketplace.')
        setLoading(false)
        return
      }

      rows = (fallbackRows as LegacyPublicBusinessRow[]).map(normalizeLegacyRow)
      setError('Filtro por categoria indisponível no momento. Exibindo listagem padrão.')
    }

    const dedupedShops = Array.from(new Map(rows.map((shop) => [shop.id, shop])).values())
    if (dedupedShops.length === 0) {
      setShops([])
      setLoading(false)
      return
    }

    const withAvatar = await Promise.all(
      dedupedShops.map(async (shop) => {
        const avatarSignedUrl = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop.avatar_url)
        return {
          ...shop,
          avatarSignedUrl,
          serviceCount: shop.services_count || 0,
          professionalCount: shop.professionals_count || 0,
          description: 'Atendimento profissional com agendamento online e horários flexíveis.',
        }
      })
    )

    setShops(withAvatar)
    if (withAvatar.every((shop) => !shop.can_book)) {
      setError('Nenhuma empresa pronta para agendamento. Exibindo cadastros em modo de configuração.')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadShops()
  }, [])

  const categoryMeta = useMemo(() => {
    const counts = new Map<string, number>()
    shops.forEach((shop) => {
      shop.category_slugs.forEach((slug) => {
        counts.set(slug, (counts.get(slug) || 0) + 1)
      })
    })

    return [
      { id: ALL_CATEGORIES_FILTER, label: 'Todas', count: shops.length },
      ...DEFAULT_SERVICE_CATEGORIES
        .map((category) => ({
          id: category.slug,
          label: category.name,
          count: counts.get(category.slug) || 0,
        })),
    ]
  }, [shops])

  const visibleShops = useMemo(() => {
    const q = normalize(query)
    return shops.filter((shop) => {
      const searchable = [
        shop.name,
        shop.address,
        shop.neighborhood,
        shop.city,
        shop.state,
        ...shop.category_names,
        ...shop.service_names,
      ].join(' ').toLowerCase()
      const matchesCategory =
        activeCategory === ALL_CATEGORIES_FILTER || shop.category_slugs.includes(activeCategory)
      const matchesQuery = !q || searchable.includes(q)
      return matchesCategory && matchesQuery
    })
  }, [activeCategory, query, shops])

  const empty = useMemo(() => !loading && visibleShops.length === 0, [loading, visibleShops.length])

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-7 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(123,97,255,0.24),rgba(0,194,255,0.1)_46%,rgba(255,122,24,0.18))] p-5 shadow-[var(--shadow-card)] sm:p-7">
          <p className="text-sm font-semibold text-[var(--color-accent)]">BarberAge</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">Serviços locais</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/76">
            Escolha uma categoria, encontre uma empresa e agende online.
          </p>
        </header>

        <section className="mb-5 space-y-3">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por empresa, serviço, categoria ou cidade"
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-3 pl-10 pr-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
            />
          </div>
          <CategoryTabs
            categories={categoryMeta}
            activeCategory={activeCategory}
            onCategoryChange={(id) => setActiveCategory(id as MarketplaceCategoryFilter)}
          />
        </section>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {empty && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-8 text-center text-sm text-[var(--color-text-muted)]">
            Nenhuma empresa ativa encontrada.
          </div>
        )}

        {!loading && error && (
          <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            {error}
          </div>
        )}

        {!loading && visibleShops.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleShops.map((shop) => (
              <article
                key={String(shop.id)}
                className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]"
              >
                <div className="mb-4 flex items-center gap-3">
                  {shop.avatarSignedUrl ? (
                    <img
                      src={shop.avatarSignedUrl}
                      alt={`Logo da ${shop.name}`}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="brand-gradient-soft flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-sm font-bold text-[var(--color-text)]">
                      {shop.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[var(--color-text)]">{shop.name}</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {shop.professionalCount} profissionais · {shop.serviceCount} serviços
                    </p>
                    {shop.category_names.length > 0 && (
                      <p className="mt-1 truncate text-xs font-medium text-[var(--color-accent)]">
                        {shop.category_names.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                <p className="mb-2 text-sm text-[var(--color-text-muted)]">{shop.description}</p>
                <p className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <MapPin size={13} />
                  {formatLocation(shop)}
                </p>

                {shop.can_book ? (
                  <Link
                    to={`/empresas/${shop.slug}`}
                    className="brand-gradient-bg inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
                  >
                    <CalendarPlus size={16} />
                    Agendar
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)]"
                  >
                    <CalendarPlus size={16} />
                    Em configuração
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
