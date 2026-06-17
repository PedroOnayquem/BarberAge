import { Link } from 'react-router-dom'
import type { MarketplaceShop } from './types'

interface FeaturedCarouselProps {
  shops: MarketplaceShop[]
}

function compactCityState(shop: Pick<MarketplaceShop, 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  return cityState || 'Local não informado'
}

export function FeaturedCarousel({ shops }: FeaturedCarouselProps) {
  if (shops.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[var(--color-text)]">Em destaque</h3>
        <span className="text-xs text-[var(--color-text-muted)]">{shops.length} opções</span>
      </div>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex gap-3 pb-1 md:grid md:w-full md:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <Link
              key={shop.id}
              to={`/cliente/empresas/${shop.slug}`}
              onClick={() => localStorage.setItem('barberage_client_preferred_shop', shop.id)}
              className="w-[172px] shrink-0 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-3 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:bg-white/[0.08] md:w-auto md:shrink"
            >
              {shop.avatarSignedUrl ? (
                <img
                  src={shop.avatarSignedUrl}
                  alt={`Logo da ${shop.name}`}
                  className="h-14 w-14 rounded-2xl object-cover"
                />
              ) : (
                <div className="brand-gradient-soft flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-sm font-bold text-[var(--color-text)]">
                  {shop.name.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="mt-2 truncate text-sm font-semibold text-[var(--color-text)]">{shop.name}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{compactCityState(shop)}</p>
              {shop.category_names[0] && (
                <p className="mt-1 truncate text-xs font-medium text-[var(--color-text-muted)]">{shop.category_names[0]}</p>
              )}
              <span className="mt-2 inline-flex rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
                Agenda disponível
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
