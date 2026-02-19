import { useEffect, useState } from 'react'
import { Calendar, Users, Scissors, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

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

  useEffect(() => {
    if (currentShop) loadDashboard()
  }, [currentShop])

  async function loadDashboard() {
    if (!currentShop) return
    setLoading(true)

    const now = new Date()
    const todayStart = startOfDay(now).toISOString()
    const todayEnd = endOfDay(now).toISOString()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()

    const [todayRes, monthRes, clientsRes, servicesRes, profRes, pendingRes, recentRes] =
      await Promise.all([
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .gte('start_at', todayStart)
          .lte('start_at', todayEnd)
          .not('status', 'in', '("cancelled","no_show")'),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', currentShop.id)
          .gte('start_at', monthStart)
          .lte('start_at', monthEnd)
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
          .gte('start_at', todayStart)
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  const statCards = [
    { label: 'Agendamentos hoje', value: stats.todayAppointments, icon: Calendar, color: 'text-amber-600 dark:text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Agendamentos no mês', value: stats.monthAppointments, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Clientes cadastrados', value: stats.totalClients, icon: Users, color: 'text-emerald-600 dark:text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Serviços ativos', value: stats.activeServices, icon: Scissors, color: 'text-purple-600 dark:text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Profissionais ativos', value: stats.activeProfessionals, icon: Clock, color: 'text-cyan-600 dark:text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
    { label: 'Pendentes', value: stats.pendingAppointments, icon: AlertCircle, color: 'text-orange-600 dark:text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Visão geral da sua barbearia
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Agenda de hoje
        </h2>
        {recentAppointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Nenhum agendamento para hoje
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {recentAppointments.map((apt) => {
              const s = statusMap[apt.status] || statusMap.pending
              return (
                <div key={apt.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {format(new Date(apt.start_at), 'HH:mm')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {apt.clients?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
