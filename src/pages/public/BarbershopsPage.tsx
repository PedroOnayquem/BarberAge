import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Scissors } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../../lib/avatarStorage'
import type { Tables } from '../../types/database'

type Shop = Tables<'shops'>
type Service = Tables<'services'>
type Professional = Tables<'professionals'>

type ShopCard = Shop & {
  description: string
  serviceCount: number
  professionalCount: number
  avatarSignedUrl: string | null
}

export function BarbershopsPage() {
  const [shops, setShops] = useState<ShopCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadShops()
  }, [])

  async function loadShops() {
    setLoading(true)
    setError('')

    const [shopsRes, servicesRes, professionalsRes] = await Promise.all([
      supabase
        .from('barbershops')
        .select('id, name, slug, address, avatar_url, phone, timezone, created_at')
        .order('name'),
      supabase.from('services').select('*').eq('active', true),
      supabase.from('professionals').select('*').eq('active', true),
    ])

    if (shopsRes.error) {
      setShops([])
      setError('Não foi possível carregar as barbearias. Verifique as políticas de leitura do marketplace.')
      setLoading(false)
      return
    }

    const rawShops = (shopsRes.data || []) as Shop[]
    const dedupedShops = Array.from(new Map(rawShops.map((shop) => [shop.id, shop])).values())
    const activeServices = (servicesRes.data || []) as Service[]
    const activeProfessionals = (professionalsRes.data || []) as Professional[]
    const canFilterByCatalog = !servicesRes.error && !professionalsRes.error

    const serviceCountByShop = activeServices.reduce<Record<string, number>>((acc, service) => {
      acc[service.shop_id] = (acc[service.shop_id] || 0) + 1
      return acc
    }, {})
    const professionalCountByShop = activeProfessionals.reduce<Record<string, number>>((acc, professional) => {
      acc[professional.shop_id] = (acc[professional.shop_id] || 0) + 1
      return acc
    }, {})

    // Consideramos "barbearia ativa" quando há pelo menos 1 serviço e 1 profissional ativo.
    const activeShops = canFilterByCatalog
      ? dedupedShops.filter((shop) => {
          return (serviceCountByShop[shop.id] || 0) > 0 && (professionalCountByShop[shop.id] || 0) > 0
        })
      : dedupedShops
    const visibleShops =
      canFilterByCatalog && activeShops.length === 0 && dedupedShops.length > 0 ? dedupedShops : activeShops

    const withAvatar = await Promise.all(
      visibleShops.map(async (shop) => {
        const avatarSignedUrl = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop.avatar_url)
        return {
          ...shop,
          avatarSignedUrl,
          serviceCount: serviceCountByShop[shop.id] || 0,
          professionalCount: professionalCountByShop[shop.id] || 0,
          description: 'Atendimento profissional com agendamento online e horários flexíveis.',
        }
      })
    )

    setShops(withAvatar)
    if (!canFilterByCatalog) {
      setError('Catálogo parcial: não foi possível validar serviços/profissionais ativos para todas as barbearias.')
    } else if (activeShops.length === 0 && rawShops.length > 0) {
      setError('Nenhuma barbearia com catálogo ativo. Exibindo barbearias cadastradas em modo de configuração.')
    }
    setLoading(false)
  }

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

                {shop.serviceCount > 0 && shop.professionalCount > 0 ? (
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
