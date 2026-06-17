import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Users, Scissors, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { getSignedAvatarUrl, SHOP_AVATARS_BUCKET } from '../lib/avatarStorage'
import { formatTimeInTimeZone, getUtcRangeForLocalDate, getUtcRangeForLocalMonth } from '../lib/timezone'

interface Stats {
  todayAppointments: number
  monthAppointments: number
  totalClients: number
  activeServices: number
  activeProfessionals: number
  pendingAppointments: number
}

interface RecentAppointment {
  id: string
  start_at: string
  status: string
  clients: { name: string } | null
  professionals: { name: string } | null
}

const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  pending: { label: 'Pendente', variant: 'warning' },
  confirmed: { label: 'Confirmado', variant: 'info' },
  completed: { label: 'Concluído', variant: 'success' },
  cancelled: { label: 'Cancelado', variant: 'danger' },
  no_show: { label: 'Não compareceu', variant: 'default' },
}

export function DashboardPage() {
  const { currentShop } = useAuth()
  const [stats, setStats] = useState<Stats>({
    todayAppointments: 0,
    monthAppointments: 0,
    totalClients: 0,
    activeServices: 0,
    activeProfessionals: 0,
    pendingAppointments: 0,
  })
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [shopAvatar, setShopAvatar] = useState<string | null>(null)

  useEffect(() => {
    if (currentShop) {
      void loadDashboard()
    } else {
      setLoading(false)
    }
  }, [currentShop])

  useEffect(() => {
    let mounted = true
    async function loadAvatar() {
      const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, currentShop?.avatar_url)
      if (mounted) setShopAvatar(signed)
    }
    loadAvatar()
    return () => {
      mounted = false
    }
  }, [currentShop?.avatar_url])

  async function loadDashboard() {
    if (!currentShop) return
    setLoading(true)

    const now = new Date()
    const shopTimeZone = currentShop.timezone || 'America/Sao_Paulo'
    const todayRange = getUtcRangeForLocalDate(now, shopTimeZone)
    const monthRange = getUtcRangeForLocalMonth(now, shopTimeZone)

    const [todayRes, monthRes, clientsRes, servicesRes, profRes, pendingRes, recentRes] =
      await Promise.all([
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .gte('start_at', todayRange.startIso)
          .lt('start_at', todayRange.endExclusiveIso)
          .not('status', 'in', '("cancelled","no_show")'),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .gte('start_at', monthRange.startIso)
          .lt('start_at', monthRange.endExclusiveIso)
          .not('status', 'in', '("cancelled","no_show")'),
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id),
        supabase
          .from('services')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .eq('active', true),
        supabase
          .from('professionals')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .eq('active', true),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .eq('status', 'pending'),
        supabase
          .from('appointments')
          .select('id, start_at, status, clients(name), professionals(name)')
          .eq('shop_id', currentShop.id)
          .gte('start_at', todayRange.startIso)
          .lt('start_at', todayRange.endExclusiveIso)
          .order('start_at', { ascending: true })
          .limit(10),
      ])

    setStats({
      todayAppointments: todayRes.count || 0,
      monthAppointments: monthRes.count || 0,
      totalClients: clientsRes.count || 0,
      activeServices: servicesRes.count || 0,
      activeProfessionals: profRes.count || 0,
      pendingAppointments: pendingRes.count || 0,
    })

    setRecentAppointments((recentRes.data as any) || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  if (!currentShop) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
          <p className="text-sm text-[var(--color-text-muted)]">
            Nenhuma empresa vinculada a esta conta no momento.
          </p>
          <Link
            to="/create-shop"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            Abrir cadastro da empresa
          </Link>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Agendamentos hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-soft)]' },
    { label: 'Agendamentos no mês', value: stats.monthAppointments, icon: TrendingUp, color: 'text-[var(--color-text)]', bg: 'bg-[var(--color-surface-muted)]' },
    { label: 'Clientes cadastrados', value: stats.totalClients, icon: Users, color: 'text-[var(--color-text)]', bg: 'bg-[var(--color-surface-muted)]' },
    { label: 'Serviços ativos', value: stats.activeServices, icon: Scissors, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-soft)]' },
    { label: 'Profissionais ativos', value: stats.activeProfessionals, icon: Clock, color: 'text-[var(--color-text)]', bg: 'bg-[var(--color-surface-muted)]' },
    { label: 'Pendentes', value: stats.pendingAppointments, icon: AlertCircle, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-soft)]' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Visão geral da sua empresa
        </p>
        <div className="mt-4 flex items-center gap-3">
          {shopAvatar ? (
            <img src={shopAvatar} alt="Logo da empresa" className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-lg font-bold text-[var(--color-text)]">
              {(currentShop?.name || 'B').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">{currentShop?.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{currentShop?.slug}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={`dashboard-stat-${index}`}>
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text)]">{stat.value}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">
          Agenda de hoje
        </h2>
        {recentAppointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            Nenhum agendamento para hoje
          </p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {recentAppointments.map((apt) => {
              const s = statusMap[apt.status] || statusMap.pending
              return (
                <div key={apt.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {formatTimeInTimeZone(apt.start_at, currentShop?.timezone || 'America/Sao_Paulo')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {apt.clients?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        com {apt.professionals?.name || 'Profissional'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
