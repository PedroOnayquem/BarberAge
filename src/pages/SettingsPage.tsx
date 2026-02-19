import { useEffect, useState, type FormEvent } from 'react'
import { Save, Plus, Trash2, Clock, CalendarOff, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { format, parseISO } from 'date-fns'
import { translateError } from '../lib/errorMessages'
import type { Tables } from '../types/database'

type Shop = Tables<'shops'>
type BusinessHour = Tables<'business_hours'>
type TimeOff = Tables<'time_off'>
type Professional = Tables<'professionals'>
type ShopMember = Tables<'shop_members'>

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

export function SettingsPage() {
  const { currentShop, membership } = useAuth()
  const isAdmin = membership?.role === 'admin'

  const [activeTab, setActiveTab] = useState<'shop' | 'hours' | 'timeoff' | 'members'>('shop')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Configure sua barbearia
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {[
          { key: 'shop' as const, label: 'Dados da barbearia' },
          { key: 'hours' as const, label: 'Horários' },
          { key: 'timeoff' as const, label: 'Folgas e bloqueios' },
          { key: 'members' as const, label: 'Equipe' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'shop' && <ShopSettings shop={currentShop} isAdmin={isAdmin} />}
      {activeTab === 'hours' && <BusinessHoursSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
      {activeTab === 'timeoff' && <TimeOffSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
      {activeTab === 'members' && <MembersSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
    </div>
  )
}

function ShopSettings({ shop, isAdmin }: { shop: Shop | null; isAdmin: boolean }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (shop) {
      setName(shop.name)
      setPhone(shop.phone || '')
      setAddress(shop.address || '')
      setTimezone(shop.timezone)
    }
  }, [shop])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shop) return
    setLoading(true)
    setSuccess(false)

    await supabase.from('shops').update({
      name,
      phone: phone || null,
      address: address || null,
      timezone,
    }).eq('id', shop.id)

    setLoading(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  function handleCopySlug() {
    if (!shop) return
    navigator.clipboard.writeText(shop.slug)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Client code card */}
      {shop && (
        <Card>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Código para clientes</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Compartilhe este código com seus clientes para que eles possam se cadastrar e agendar serviços na sua barbearia.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                {shop.slug}
              </div>
              <button
                onClick={handleCopySlug}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Shop info form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nome da barbearia" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} required />
          <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isAdmin} />
          <Input label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isAdmin} />
          <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!isAdmin}>
            <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
            <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Belem">Belém (GMT-3)</option>
            <option value="America/Recife">Recife (GMT-3)</option>
            <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
            <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
          </Select>

          {isAdmin && (
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={loading}>
                <Save size={16} /> Salvar
              </Button>
              {success && <span className="text-sm text-emerald-600 dark:text-emerald-400">Salvo com sucesso!</span>}
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}

function BusinessHoursSettings({ shopId, isAdmin }: { shopId: string | undefined; isAdmin: boolean }) {
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (shopId) loadHours()
  }, [shopId])

  async function loadHours() {
    if (!shopId) return
    setLoading(true)
    const { data } = await supabase
      .from('business_hours')
      .select('*')
      .eq('shop_id', shopId)
      .order('weekday')
    setHours(data || [])
    setLoading(false)
  }

  function getHourForDay(weekday: number): BusinessHour | undefined {
    return hours.find((h) => h.weekday === weekday)
  }

  async function handleSave(weekday: number, startTime: string, endTime: string, closed: boolean) {
    if (!shopId) return
    setSaving(true)

    const existing = getHourForDay(weekday)
    if (existing) {
      await supabase.from('business_hours').update({
        start_time: closed ? null : startTime,
        end_time: closed ? null : endTime,
        closed,
      }).eq('id', existing.id)
    } else {
      await supabase.from('business_hours').insert({
        shop_id: shopId,
        weekday,
        start_time: closed ? null : startTime,
        end_time: closed ? null : endTime,
        closed,
      })
    }

    await loadHours()
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-500" />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Horários de funcionamento</h2>
      </div>

      <div className="space-y-3">
        {WEEKDAYS.map((day) => (
          <DayRow
            key={day.value}
            label={day.label}
            weekday={day.value}
            hour={getHourForDay(day.value)}
            onSave={handleSave}
            disabled={!isAdmin || saving}
          />
        ))}
      </div>
    </Card>
  )
}

function DayRow({
  label,
  weekday,
  hour,
  onSave,
  disabled,
}: {
  label: string
  weekday: number
  hour: BusinessHour | undefined
  onSave: (weekday: number, start: string, end: string, closed: boolean) => void
  disabled: boolean
}) {
  const [startTime, setStartTime] = useState(hour?.start_time || '09:00')
  const [endTime, setEndTime] = useState(hour?.end_time || '19:00')
  const [closed, setClosed] = useState(hour?.closed ?? false)

  useEffect(() => {
    if (hour) {
      setStartTime(hour.start_time || '09:00')
      setEndTime(hour.end_time || '19:00')
      setClosed(hour.closed)
    }
  }, [hour])

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-100 p-3 dark:border-zinc-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 sm:w-40">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!closed}
            onChange={(e) => setClosed(!e.target.checked)}
            disabled={disabled}
            className="accent-amber-600"
          />
          <span className={`text-sm font-medium ${closed ? 'text-zinc-400 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {label}
          </span>
        </label>
      </div>

      {!closed && (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <span className="text-sm text-zinc-400">até</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={disabled}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => onSave(weekday, startTime, endTime, closed)}
      >
        Salvar
      </Button>
    </div>
  )
}

function TimeOffSettings({ shopId, isAdmin }: { shopId: string | undefined; isAdmin: boolean }) {
  const [timeOffs, setTimeOffs] = useState<(TimeOff & { professionals: { name: string } | null })[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const [formProfId, setFormProfId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formStartTime, setFormStartTime] = useState('00:00')
  const [formEndDate, setFormEndDate] = useState('')
  const [formEndTime, setFormEndTime] = useState('23:59')
  const [formReason, setFormReason] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (shopId) loadData()
  }, [shopId])

  async function loadData() {
    if (!shopId) return
    setLoading(true)
    const [toRes, profRes] = await Promise.all([
      supabase
        .from('time_off')
        .select('*, professionals(name)')
        .eq('shop_id', shopId)
        .order('start_at', { ascending: false }),
      supabase.from('professionals').select('*').eq('shop_id', shopId).eq('active', true),
    ])
    setTimeOffs((toRes.data as any) || [])
    setProfessionals(profRes.data || [])
    setLoading(false)
  }

  function openNew() {
    setFormProfId('')
    setFormStartDate('')
    setFormStartTime('00:00')
    setFormEndDate('')
    setFormEndTime('23:59')
    setFormReason('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shopId) return
    setFormError('')

    if (!formStartDate || !formEndDate) {
      setFormError('Preencha as datas')
      return
    }

    setFormLoading(true)

    const startAt = new Date(`${formStartDate}T${formStartTime}:00`).toISOString()
    const endAt = new Date(`${formEndDate}T${formEndTime}:00`).toISOString()

    const { error } = await supabase.from('time_off').insert({
      shop_id: shopId,
      professional_id: formProfId || null,
      start_at: startAt,
      end_at: endAt,
      reason: formReason || null,
    })

    if (error) {
      setFormError(translateError(error.message))
      setFormLoading(false)
      return
    }

    setFormLoading(false)
    setModalOpen(false)
    loadData()
  }

  async function handleDelete(id: string) {
    await supabase.from('time_off').delete().eq('id', id)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Folgas e bloqueios</h2>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openNew}>
              <Plus size={14} /> Novo bloqueio
            </Button>
          )}
        </div>

        {timeOffs.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Nenhum bloqueio cadastrado
          </p>
        ) : (
          <div className="space-y-2">
            {timeOffs.map((to) => (
              <div key={to.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-700">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {to.professionals?.name || 'Toda a barbearia'}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {format(parseISO(to.start_at), 'dd/MM/yyyy HH:mm')} — {format(parseISO(to.end_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                  {to.reason && (
                    <p className="mt-0.5 text-xs text-zinc-400">{to.reason}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(to.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo bloqueio de horário">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}

          <Select label="Profissional (vazio = toda a barbearia)" value={formProfId} onChange={(e) => setFormProfId(e.target.value)}>
            <option value="">Toda a barbearia</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data início" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} required />
            <Input label="Hora início" type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data fim" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} required />
            <Input label="Hora fim" type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
          </div>

          <Input label="Motivo" value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="Ex: Férias, folga..." />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={formLoading}>Criar bloqueio</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

function MembersSettings({ shopId, isAdmin }: { shopId: string | undefined; isAdmin: boolean }) {
  const [members, setMembers] = useState<(ShopMember & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (shopId) loadMembers()
  }, [shopId])

  async function loadMembers() {
    if (!shopId) return
    setLoading(true)
    const { data } = await supabase
      .from('shop_members')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at')
    setMembers(data || [])
    setLoading(false)
  }

  async function handleRoleChange(memberId: string, role: string) {
    await supabase.from('shop_members').update({ role: role as any }).eq('id', memberId)
    loadMembers()
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Tem certeza que deseja remover este membro?')) return
    await supabase.from('shop_members').delete().eq('id', memberId)
    loadMembers()
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    professional: 'Profissional',
    reception: 'Recepção',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Membros da equipe</h2>

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-700">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {member.user_id.slice(0, 8)}...
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {roleLabels[member.role] || member.role}
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="admin">Admin</option>
                  <option value="professional">Profissional</option>
                  <option value="reception">Recepção</option>
                </select>
                <button
                  onClick={() => handleRemove(member.id)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
