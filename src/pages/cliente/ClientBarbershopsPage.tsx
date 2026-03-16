import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Scissors } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import { CategoryTabs } from '../../components/cliente/marketplace/CategoryTabs'
import { FeaturedCarousel } from '../../components/cliente/marketplace/FeaturedCarousel'
import { PromoBanner } from '../../components/cliente/marketplace/PromoBanner'
import { ShopListCard } from '../../components/cliente/marketplace/ShopListCard'
import type { MarketplaceShop } from '../../components/cliente/marketplace/types'
import type { Database } from '../../types/database'

type FilteredPublicBarbershopStatus =
  Database['public']['Functions']['list_public_barbershops_with_status_filtered']['Returns'][number]

type ShopCard = FilteredPublicBarbershopStatus & {
  description: string
  statusLabel: string
  reason: string
  isPreferred: boolean
  avatarSignedUrl: string | null
}

type CategoryId = 'all' | 'nearby' | 'popular' | 'available' | 'promotions'

function formatLocation(shop: Pick<ShopCard, 'address' | 'neighborhood' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, shop.neighborhood, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

function scorePopularity(shop: ShopCard) {
  return (shop.services_count || 0) * 2 + (shop.professionals_count || 0)
}

function asMarketplaceShop(shop: ShopCard): MarketplaceShop {
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    address: shop.address,
    neighborhood: shop.neighborhood,
    city: shop.city,
    state: shop.state,
    avatarSignedUrl: shop.avatarSignedUrl,
    can_book: shop.can_book,
    isPreferred: shop.isPreferred,
    services_count: shop.services_count,
    professionals_count: shop.professionals_count,
    statusLabel: shop.statusLabel,
    reason: shop.reason,
  }
}

export function ClientBarbershopsPage() {
  const { clientShop } = useAuth()
  const [shops, setShops] = useState<ShopCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')

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

  async function loadShops() {
    setLoading(true)
    setError('')

    const preferredShopId =
      localStorage.getItem('barberage_client_preferred_shop') || clientShop?.id || null

    const { data: filteredRows, error: filteredError } = await supabase.rpc(
      'list_public_barbershops_with_status_filtered',
      { p_city: null, p_state: null }
    )

    if (filteredError) {
      const { data: baseRows, error: baseError } = await supabase.rpc('list_public_barbershops_with_status')
      if (baseError || !baseRows) {
        setShops([])
        setError('Não foi possível carregar as barbearias agora.')
        setLoading(false)
        return
      }

      const cards = await buildCards(baseRows as FilteredPublicBarbershopStatus[], preferredShopId)
      setShops(cards)
      setError('Filtro indisponível no momento. Exibindo listagem padrão.')
      setLoading(false)
      return
    }

    const cards = await buildCards((filteredRows || []) as FilteredPublicBarbershopStatus[], preferredShopId)
    setShops(cards)
    setLoading(false)
  }

  useEffect(() => {
    void loadShops()
  }, [clientShop?.id])

  const categoryMeta = useMemo(() => {
    const available = shops.filter((shop) => shop.can_book)
    const nearby = shops.filter((shop) => !!shop.city || !!shop.state)
    const promotions = shops.filter((shop) => shop.can_book && shop.services_count >= 3)
    return [
      { id: 'all' as const, label: 'Todas', count: shops.length },
      { id: 'nearby' as const, label: 'Próximas', count: nearby.length },
      { id: 'popular' as const, label: 'Mais populares', count: shops.length },
      { id: 'available' as const, label: 'Com agenda disponível', count: available.length },
      { id: 'promotions' as const, label: 'Promoções', count: promotions.length },
    ]
  }, [shops])

  const visibleShops = useMemo(() => {
    const popularSorted = [...shops].sort((a, b) => scorePopularity(b) - scorePopularity(a))
    switch (activeCategory) {
      case 'available':
        return popularSorted.filter((shop) => shop.can_book)
      case 'popular':
        return popularSorted
      case 'nearby':
        return popularSorted.filter((shop) => !!shop.city || !!shop.state)
      case 'promotions':
        return popularSorted.filter((shop) => shop.can_book && shop.services_count >= 3)
      default:
        return popularSorted
    }
  }, [shops, activeCategory])

  const featuredShops = useMemo(() => {
    return visibleShops
      .filter((shop) => shop.can_book)
      .slice(0, 8)
      .map(asMarketplaceShop)
  }, [visibleShops])

  const empty = !loading && visibleShops.length === 0

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5 md:px-0 md:py-0">
      <CategoryTabs
        categories={categoryMeta}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id as CategoryId)}
      />

      <PromoBanner
        onExplore={() =>
          document.getElementById('client-shop-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
          <div className="h-36 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
          <div className="h-36 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
        </div>
      ) : (
        <>
          <FeaturedCarousel shops={featuredShops} />

          <section id="client-shop-list" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--color-text)]">Barbearias</h3>
              <span className="text-xs text-[var(--color-text-muted)]">{visibleShops.length} resultados</span>
            </div>

            {error && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {error}
              </div>
            )}

            {empty && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center text-sm text-[var(--color-text-muted)]">
                Nenhuma barbearia encontrada para essa categoria.
              </div>
            )}

            <div className="space-y-3 md:hidden">
              {visibleShops.map((shop) => (
                <ShopListCard key={shop.id} shop={asMarketplaceShop(shop)} />
              ))}
            </div>

            <div className="hidden grid-cols-2 gap-4 md:grid xl:grid-cols-3">
              {visibleShops.map((shop) => (
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
                    <>
                      <button
                        type="button"
                        disabled
                        title={shop.reason}
                        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)]"
                      >
                        <Scissors size={16} />
                        Em configuração
                      </button>
                      {shop.reason && (
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{shop.reason}</p>
                      )}
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
