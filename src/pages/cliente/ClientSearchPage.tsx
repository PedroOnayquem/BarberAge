import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Car, Hand, HeartPulse, PawPrint, Scissors, Search, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import {
  ALL_CATEGORIES_FILTER,
  DEFAULT_SERVICE_CATEGORIES,
  type MarketplaceCategoryFilter,
  type ServiceCategorySlug,
} from '../../lib/serviceCategories'
import type { Database } from '../../types/database'

type SearchShopRow =
  Database['public']['Functions']['list_public_service_businesses_with_status_filtered']['Returns'][number]
type LegacySearchShopRow =
  Database['public']['Functions']['list_public_barbershops_with_status_filtered']['Returns'][number]

interface SearchShop extends SearchShopRow {
  avatarSignedUrl: string | null
}

const CATEGORY_ICON_MAP: Record<ServiceCategorySlug, typeof Sparkles> = {
  barbershop: Scissors,
  manicure: Hand,
  car_wash: Car,
  aesthetics: Sparkles,
  massage: HeartPulse,
  pet_care: PawPrint,
}

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function formatLocation(shop: Pick<SearchShop, 'address' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

function normalizeLegacyRow(shop: LegacySearchShopRow): SearchShopRow {
  return {
    ...shop,
    category_slugs: ['barbershop'],
    category_names: ['Barbearia'],
    service_names: [],
  }
}

export function ClientSearchPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategoryFilter>(ALL_CATEGORIES_FILTER)
  const [shops, setShops] = useState<SearchShop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')

    const { data: shopRows, error: shopsError } = await supabase.rpc(
      'list_public_service_businesses_with_status_filtered',
      { p_search: null, p_category_slug: null, p_city: null, p_state: null }
    )

    let rows = (shopRows || []) as SearchShopRow[]
    if (shopsError) {
      const { data: baseRows, error: baseError } = await supabase.rpc('list_public_barbershops_with_status')
      if (baseError || !baseRows) {
        setShops([])
        setError('Não foi possível carregar a busca agora.')
        setLoading(false)
        return
      }
      rows = (baseRows as LegacySearchShopRow[]).map(normalizeLegacyRow)
    }

    const deduped = Array.from(new Map(rows.map((shop) => [shop.id, shop])).values())
    const mapped = await Promise.all(
      deduped.map(async (shop) => ({
        ...shop,
        avatarSignedUrl: await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop.avatar_url),
      }))
    )

    setShops(mapped)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const categoryCards = useMemo(() => {
    const counts = new Map<string, number>()
    shops.forEach((shop) => {
      shop.category_slugs.forEach((slug) => {
        counts.set(slug, (counts.get(slug) || 0) + 1)
      })
    })

    return [
      { id: ALL_CATEGORIES_FILTER, label: 'Todos', icon: Sparkles, count: shops.length },
      ...DEFAULT_SERVICE_CATEGORIES.map((category) => ({
        id: category.slug,
        label: category.name,
        icon: CATEGORY_ICON_MAP[category.slug],
        count: counts.get(category.slug) || 0,
      })),
    ]
  }, [shops])

  const filteredShops = useMemo(() => {
    const q = normalize(query)

    return shops.filter((shop) => {
      const searchable = [
        shop.name,
        shop.address || '',
        shop.neighborhood || '',
        shop.city || '',
        shop.state || '',
        ...shop.category_names,
        ...shop.service_names,
      ]
        .join(' ')
        .toLowerCase()

      const matchesQuery = !q || searchable.includes(q)
      const matchesCategory =
        activeCategory === ALL_CATEGORIES_FILTER || shop.category_slugs.includes(activeCategory)

      return matchesQuery && matchesCategory
    })
  }, [shops, query, activeCategory])

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5 md:px-0 md:py-0">
      <section className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4 shadow-[var(--shadow-card)]">
        <label htmlFor="client-search-input" className="mb-2 block text-xs font-semibold text-[var(--color-text-muted)]">
          Buscar empresa, serviço ou cidade
        </label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            id="client-search-input"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex: manicure, lavagem, centro..."
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-3 pl-10 pr-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--color-text)]">Categorias</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {categoryCards.map((category) => {
            const Icon = category.icon
            const active = activeCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id as MarketplaceCategoryFilter)}
                className={`min-h-[112px] rounded-2xl border p-3 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 ${
                  active
                    ? 'brand-gradient-bg border-white/20 text-white'
                    : 'border-[var(--color-border)] bg-white/[0.055] hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]'
                }`}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${active ? 'border-white/20 bg-white/18 text-white' : 'border-white/10 bg-white/[0.06] text-[var(--color-accent)]'}`}>
                  <Icon size={19} />
                </span>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{category.label}</p>
                <p className={`mt-0.5 text-xs ${active ? 'text-white/78' : 'text-[var(--color-text-muted)]'}`}>{category.count} empresas</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Resultados</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{filteredShops.length} itens</span>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            {error}
          </div>
        )}

        {!loading && !error && filteredShops.length === 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-6 text-center text-sm text-[var(--color-text-muted)]">
            Nenhuma empresa encontrada com esse filtro.
          </div>
        )}

        {!loading &&
          filteredShops.map((shop) => (
            <Link
              key={shop.id}
              to={`/cliente/empresas/${shop.slug}`}
              className="block rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-3 shadow-[var(--shadow-card)] transition-all hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]"
            >
              <div className="flex items-center gap-3">
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{shop.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatLocation(shop)}</p>
                  {shop.category_names.length > 0 && (
                    <p className="mt-1 truncate text-xs font-medium text-[var(--color-accent)]">
                      {shop.category_names.join(' · ')}
                    </p>
                  )}
                </div>
                {shop.can_book && (
                  <span className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
                    Disponível
                  </span>
                )}
              </div>
            </Link>
          ))}
      </section>
    </div>
  )
}
