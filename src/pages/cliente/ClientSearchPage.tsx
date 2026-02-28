import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgePercent, Brush, Gem, Scissors, Search, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import type { Database } from '../../types/database'

type SearchShopRow =
  Database['public']['Functions']['list_public_barbershops_with_status_filtered']['Returns'][number]

interface SearchShop extends SearchShopRow {
  avatarSignedUrl: string | null
  serviceNames: string[]
}

type CategoryId = 'all' | 'corte' | 'barba' | 'degrade' | 'sobrancelha' | 'pacote'

const CATEGORIES: Array<{
  id: CategoryId
  label: string
  icon: typeof Scissors
  keywords: string[]
  bg: string
}> = [
  { id: 'all', label: 'Todos', icon: Sparkles, keywords: [], bg: 'bg-[var(--color-accent-soft)]' },
  { id: 'corte', label: 'Corte', icon: Scissors, keywords: ['corte'], bg: 'bg-[var(--color-primary-soft)]' },
  { id: 'barba', label: 'Barba', icon: Brush, keywords: ['barba'], bg: 'bg-[var(--color-accent-soft)]' },
  { id: 'degrade', label: 'Degradê', icon: Gem, keywords: ['degrade', 'degradê'], bg: 'bg-[var(--color-primary-soft)]' },
  { id: 'sobrancelha', label: 'Sobrancelha', icon: Sparkles, keywords: ['sobrancelha'], bg: 'bg-[var(--color-accent-soft)]' },
  { id: 'pacote', label: 'Pacote', icon: BadgePercent, keywords: ['pacote', 'combo'], bg: 'bg-[var(--color-primary-soft)]' },
]

function normalize(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function formatLocation(shop: Pick<SearchShop, 'address' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

export function ClientSearchPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [shops, setShops] = useState<SearchShop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    const [shopsRes, servicesRes] = await Promise.all([
      supabase.rpc('list_public_barbershops_with_status_filtered', { p_city: null, p_state: null }),
      supabase.from('services').select('shop_id, name').eq('active', true),
    ])

    let shopRows = (shopsRes.data || []) as SearchShopRow[]
    if (shopsRes.error) {
      const { data: baseRows, error: baseError } = await supabase.rpc('list_public_barbershops_with_status')
      if (baseError || !baseRows) {
        setShops([])
        setError('Não foi possível carregar a busca agora.')
        setLoading(false)
        return
      }
      shopRows = baseRows as SearchShopRow[]
    }

    const serviceNamesByShop = new Map<string, string[]>()
    ;(servicesRes.data || []).forEach((service) => {
      const list = serviceNamesByShop.get(service.shop_id) || []
      list.push(service.name)
      serviceNamesByShop.set(service.shop_id, list)
    })

    const deduped = Array.from(new Map(shopRows.map((shop) => [shop.id, shop])).values())
    const mapped = await Promise.all(
      deduped.map(async (shop) => ({
        ...shop,
        avatarSignedUrl: await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop.avatar_url),
        serviceNames: serviceNamesByShop.get(shop.id) || [],
      }))
    )

    setShops(mapped)
    setLoading(false)
  }

  const filteredShops = useMemo(() => {
    const q = normalize(query)
    const category = CATEGORIES.find((item) => item.id === activeCategory)

    return shops.filter((shop) => {
      const searchable = [
        shop.name,
        shop.address || '',
        shop.city || '',
        shop.state || '',
        ...shop.serviceNames,
      ]
        .join(' ')
        .toLowerCase()

      const matchesQuery = !q || searchable.includes(q)
      const matchesCategory =
        !category ||
        category.id === 'all' ||
        category.keywords.some((keyword) =>
          shop.serviceNames.some((serviceName) => normalize(serviceName).includes(keyword))
        )

      return matchesQuery && matchesCategory
    })
  }, [shops, query, activeCategory])

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5 md:px-0 md:py-0">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-[var(--shadow-card)]">
        <label htmlFor="client-search-input" className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          Buscar barbearia ou serviço
        </label>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            id="client-search-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: corte degradê, barba..."
            className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] py-3 pl-10 pr-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Categorias</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            const active = activeCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`rounded-2xl border p-3 text-left shadow-[var(--shadow-card)] transition-colors ${
                  active
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : `border-[var(--color-border)] ${category.bg}`
                }`}
              >
                <Icon size={20} className={active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'} />
                <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{category.label}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Resultados</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{filteredShops.length} itens</span>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            {error}
          </div>
        )}

        {!loading && !error && filteredShops.length === 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center text-sm text-[var(--color-text-muted)]">
            Nenhuma barbearia encontrada com esse filtro.
          </div>
        )}

        {!loading &&
          filteredShops.map((shop) => (
            <Link
              key={shop.id}
              to={`/cliente/barbearias/${shop.slug}`}
              className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3">
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
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{shop.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatLocation(shop)}</p>
                </div>
                {shop.can_book && (
                  <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
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
