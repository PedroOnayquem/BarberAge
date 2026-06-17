import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarPlus,
  Car,
  Hand,
  HeartPulse,
  MapPin,
  PawPrint,
  Scissors,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import {
  ALL_CATEGORIES_FILTER,
  DEFAULT_SERVICE_CATEGORIES,
  getServiceCategoryLabel,
  type MarketplaceCategoryFilter,
} from '../../lib/serviceCategories'
import { FeaturedCarousel } from '../../components/cliente/marketplace/FeaturedCarousel'
import { PromoBanner } from '../../components/cliente/marketplace/PromoBanner'
import { ShopListCard } from '../../components/cliente/marketplace/ShopListCard'
import type { MarketplaceShop } from '../../components/cliente/marketplace/types'
import type { Database } from '../../types/database'

type PublicBusinessStatus =
  Database['public']['Functions']['list_public_service_businesses_with_status_filtered']['Returns'][number]
type LegacyPublicBusinessStatus =
  Database['public']['Functions']['list_public_barbershops_with_status_filtered']['Returns'][number]

type ShopCard = PublicBusinessStatus & {
  description: string
  statusLabel: string
  reason: string
  isPreferred: boolean
  avatarSignedUrl: string | null
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  [ALL_CATEGORIES_FILTER]: Sparkles,
  barbershop: Scissors,
  manicure: Hand,
  car_wash: Car,
  aesthetics: Sparkles,
  massage: HeartPulse,
  pet_care: PawPrint,
}

function formatLocation(shop: Pick<ShopCard, 'address' | 'neighborhood' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, shop.neighborhood, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

function scorePopularity(shop: ShopCard) {
  return (shop.services_count || 0) * 2 + (shop.professionals_count || 0)
}

function normalizeLegacyRow(shop: LegacyPublicBusinessStatus): PublicBusinessStatus {
  return {
    ...shop,
    category_slugs: ['barbershop'],
    category_names: ['Barbearia'],
    service_names: [],
  }
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
    category_slugs: shop.category_slugs,
    category_names: shop.category_names,
    service_names: shop.service_names,
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
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategoryFilter>(ALL_CATEGORIES_FILTER)

  function getShopCatalogStatus(shop: PublicBusinessStatus): { label: string; canBook: boolean; reason: string } {
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

  async function buildCards(rows: PublicBusinessStatus[], preferredShopId: string | null) {
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
      'list_public_service_businesses_with_status_filtered',
      { p_search: null, p_category_slug: null, p_city: null, p_state: null }
    )

    if (filteredError) {
      const { data: baseRows, error: baseError } = await supabase.rpc('list_public_barbershops_with_status')
      if (baseError || !baseRows) {
        setShops([])
        setError('Não foi possível carregar as empresas agora.')
        setLoading(false)
        return
      }

      const cards = await buildCards((baseRows as LegacyPublicBusinessStatus[]).map(normalizeLegacyRow), preferredShopId)
      setShops(cards)
      setError('Filtro por categoria indisponível no momento. Exibindo listagem padrão.')
      setLoading(false)
      return
    }

    const cards = await buildCards((filteredRows || []) as PublicBusinessStatus[], preferredShopId)
    setShops(cards)
    setLoading(false)
  }

  useEffect(() => {
    void loadShops()
  }, [clientShop?.id])

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
    const popularSorted = [...shops].sort((a, b) => scorePopularity(b) - scorePopularity(a))
    if (activeCategory === ALL_CATEGORIES_FILTER) return popularSorted
    return popularSorted.filter((shop) => shop.category_slugs.includes(activeCategory))
  }, [shops, activeCategory])

  const featuredShops = useMemo(() => {
    return visibleShops
      .filter((shop) => shop.can_book)
      .slice(0, 8)
      .map(asMarketplaceShop)
  }, [visibleShops])

  const empty = !loading && visibleShops.length === 0

  return (
    <div className="space-y-6 px-4 py-5 sm:px-5 md:px-0 md:py-0">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(123,97,255,0.25),rgba(0,194,255,0.12)_46%,rgba(255,122,24,0.18))] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold text-[var(--color-accent)]">Marketplace de serviços</p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Encontre serviços perto de você
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[rgba(255,255,255,0.76)]">
            Escolha uma categoria, compare empresas locais e agende em poucos toques.
          </p>
          <button
            type="button"
            onClick={() =>
              document.getElementById('client-shop-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="brand-gradient-bg mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-[0_18px_42px_rgba(123,97,255,0.3)] transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            Explorar empresas
            <CalendarPlus size={17} />
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">Categorias</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Navegue por tipo de serviço</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-[var(--color-text-muted)]">
            {shops.length} empresas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {categoryMeta.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] || Sparkles
            const isActive = activeCategory === category.id

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id as MarketplaceCategoryFilter)}
                className={`group min-h-[118px] rounded-2xl border p-3 text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 ${
                  isActive
                    ? 'brand-gradient-bg border-white/20 text-white'
                    : 'border-[var(--color-border)] bg-white/[0.055] text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]'
                }`}
              >
                <span
                  className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${
                    isActive
                      ? 'border-white/20 bg-white/18 text-white'
                      : 'border-white/10 bg-white/[0.06] text-[var(--color-accent)]'
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span className="block text-sm font-bold leading-tight">{category.label}</span>
                <span className={`mt-1 block text-xs ${isActive ? 'text-white/78' : 'text-[var(--color-text-muted)]'}`}>
                  {category.count} {category.count === 1 ? 'empresa' : 'empresas'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <PromoBanner
        onExplore={() =>
          document.getElementById('client-shop-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-white/[0.07]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
          <div className="h-36 animate-pulse rounded-2xl bg-white/[0.07]" />
          <div className="h-36 animate-pulse rounded-2xl bg-white/[0.07]" />
        </div>
      ) : (
        <>
          <FeaturedCarousel shops={featuredShops} />

          <section id="client-shop-list" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--color-text)]">Empresas</h3>
              <span className="text-xs text-[var(--color-text-muted)]">{visibleShops.length} resultados</span>
            </div>

            {error && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {error}
              </div>
            )}

            {empty && (
              <div className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-6 text-center text-sm text-[var(--color-text-muted)]">
                Nenhuma empresa encontrada para {activeCategory === ALL_CATEGORIES_FILTER ? 'esse filtro' : getServiceCategoryLabel(activeCategory)}.
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
                  className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]"
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
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold text-[var(--color-text)]">{shop.name}</h2>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {shop.professionals_count} profissionais · {shop.services_count} serviços · {shop.statusLabel}
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
                      to={`/cliente/empresas/${shop.slug}`}
                      onClick={() => localStorage.setItem('barberage_client_preferred_shop', shop.id)}
                      className="brand-gradient-bg inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110"
                    >
                      <CalendarPlus size={16} />
                      Agendar
                    </Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled
                        title={shop.reason}
                        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)]"
                      >
                        <CalendarPlus size={16} />
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
