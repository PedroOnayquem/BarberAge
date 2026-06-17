import { Link } from 'react-router-dom'
import { CalendarPlus, MapPin } from 'lucide-react'
import type { MarketplaceShop } from './types'

interface ShopListCardProps {
  shop: MarketplaceShop
}

function formatLocation(shop: Pick<MarketplaceShop, 'address' | 'neighborhood' | 'city' | 'state'>) {
  const cityState = [shop.city, shop.state].filter(Boolean).join(' - ')
  const segments = [shop.address, shop.neighborhood, cityState].filter(Boolean)
  return segments.join(' · ') || 'Endereço não informado'
}

export function ShopListCard({ shop }: ShopListCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] p-4 shadow-[var(--shadow-card)] transition-all duration-200 active:scale-[0.99]">
      <div className="flex items-start gap-3">
        {shop.avatarSignedUrl ? (
          <img
            src={shop.avatarSignedUrl}
            alt={`Logo da ${shop.name}`}
            className="h-14 w-14 rounded-2xl object-cover"
          />
        ) : (
          <div className="brand-gradient-soft flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-base font-bold text-[var(--color-text)]">
            {shop.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="truncate text-sm font-bold text-[var(--color-text)]">{shop.name}</h4>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {shop.professionals_count} profissionais · {shop.services_count} serviços
              </p>
              {shop.category_names.length > 0 && (
                <p className="mt-1 text-xs font-medium text-[var(--color-accent)]">
                  {shop.category_names.join(' · ')}
                </p>
              )}
            </div>
            {shop.can_book ? (
              <span className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
                Agenda disponível
              </span>
            ) : (
              <span className="rounded-full bg-white/[0.07] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                Em configuração
              </span>
            )}
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            <span className="max-h-9 overflow-hidden">{formatLocation(shop)}</span>
          </p>
        </div>
      </div>

      <div className="mt-3">
        {shop.can_book ? (
          <Link
            to={`/cliente/empresas/${shop.slug}`}
            onClick={() => localStorage.setItem('barberage_client_preferred_shop', shop.id)}
            className="brand-gradient-bg inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            <CalendarPlus size={15} />
            Agendar
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)]"
            >
              <CalendarPlus size={15} />
              Em configuração
            </button>
            {shop.reason && (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">{shop.reason}</p>
            )}
          </>
        )}
      </div>
    </article>
  )
}
