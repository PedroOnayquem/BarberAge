import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Scissors } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import type { Database } from '../../types/database'

type PublicShopRow =
  Database['public']['Functions']['list_public_barbershops_with_status']['Returns'][number]

type ShopCard = PublicShopRow & {
  description: string
  serviceCount: number
  professionalCount: number
  avatarSignedUrl: string | null
}

export function BarbershopsPage() {
  const [shops, setShops] = useState<ShopCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadShops() {
    setLoading(true)
    setError('')

    const { data: primaryRows, error: primaryError } = await supabase.rpc(
      'list_public_barbershops_with_status_filtered',
      { p_city: null, p_state: null }
    )

    let rows = (primaryRows || []) as PublicShopRow[]
    if (primaryError) {
      const { data: fallbackRows, error: fallbackError } = await supabase.rpc('list_public_barbershops_with_status')
      if (fallbackError || !fallbackRows) {
        if (import.meta.env.DEV) {
          console.error('[public-barbershops] marketplace load error', {
            primaryError,
            fallbackError,
          })
        }
        setShops([])
        setError('Não foi possível carregar as barbearias. Verifique as políticas de leitura do marketplace.')
        setLoading(false)
        return
      }

      rows = fallbackRows as PublicShopRow[]
      setError('Filtro indisponível no momento. Exibindo listagem padrão.')
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
      setError('Nenhuma barbearia pronta para agendamento. Exibindo barbearias cadastradas em modo de configuração.')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadShops()
  }, [])

  const empty = useMemo(() => !loading && shops.length === 0, [loading, shops.length])

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-7">
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Barbearias</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Descubra barbearias e agende online sem código.
          </p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {empty && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center text-sm text-[var(--color-text-muted)]">
            Nenhuma barbearia ativa encontrada.
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            {error}
          </div>
        )}

        {!loading && shops.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <article
                key={String(shop.id)}
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
                  <div>
                    <h2 className="text-base font-semibold text-[var(--color-text)]">{shop.name}</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {shop.professionalCount} profissionais · {shop.serviceCount} serviços
                    </p>
                  </div>
                </div>

                <p className="mb-2 text-sm text-[var(--color-text-muted)]">{shop.description}</p>
                <p className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                  <MapPin size={13} />
                  {shop.address || 'Endereço não informado'}
                </p>

                {shop.can_book ? (
                  <Link
                    to={`/barbearias/${shop.slug}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
                  >
                    <Scissors size={16} />
                    Agendar
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-muted)]"
                  >
                    <Scissors size={16} />
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
