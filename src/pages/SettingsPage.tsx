import { useEffect, useState, type FormEvent } from 'react'
import { Save, Plus, Trash2, Clock, CalendarOff, Copy, Check, Upload, Image as ImageIcon, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { DatePickerField } from '../components/ui/DatePickerField'
import { TimePickerField } from '../components/ui/TimePickerField'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { AvatarCropModal } from '../components/ui/AvatarCropModal'
import { format, parseISO } from 'date-fns'
import { translateError } from '../lib/errorMessages'
import { getSignedAvatarUrl, uploadShopAvatar, validateAvatarFile, SHOP_AVATARS_BUCKET } from '../lib/avatarStorage'
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

const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

export function SettingsPage() {
  const { currentShop, membership, refreshUserData, user } = useAuth()
  const isAdmin = membership?.role === 'admin'

  const [activeTab, setActiveTab] = useState<'shop' | 'hours' | 'timeoff' | 'members'>('shop')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Configurações</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Configure sua barbearia
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
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
                ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'shop' && (
        <ShopSettings
          shop={currentShop}
          isAdmin={isAdmin}
          onShopUpdated={refreshUserData}
          userId={user?.id}
        />
      )}
      {activeTab === 'hours' && <BusinessHoursSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
      {activeTab === 'timeoff' && <TimeOffSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
      {activeTab === 'members' && <MembersSettings shopId={currentShop?.id} isAdmin={isAdmin} />}
    </div>
  )
}

function ShopSettings({
  shop,
  isAdmin,
  onShopUpdated,
  userId,
}: {
  shop: Shop | null
  isAdmin: boolean
  onShopUpdated: () => Promise<void>
  userId: string | undefined
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [timezone, setTimezone] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [copiedPublicLink, setCopiedPublicLink] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)

  function getPublicBaseUrl() {
    const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim()
    if (configured) return configured.replace(/\/+$/, '')
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }

  function buildPublicShopUrl(slug: string) {
    return `${getPublicBaseUrl()}/barbearias/${slug}`
  }

  useEffect(() => {
    if (shop) {
      setName(shop.name)
      setPhone(shop.phone || '')
      setAddress(shop.address || '')
      setNeighborhood(shop.neighborhood || '')
      setCity(shop.city || '')
      setStateCode(shop.state || '')
      setTimezone(shop.timezone)
    }
  }, [shop])

  useEffect(() => {
    let mounted = true
    async function loadPreview() {
      const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, shop?.avatar_url)
      if (mounted) setAvatarPreview(signed)
    }
    loadPreview()
    return () => {
      mounted = false
    }
  }, [shop?.avatar_url])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!shop) return
    setLoading(true)
    setSuccess(false)
    setSaveError('')

    const { error } = await supabase.from('barbershops').update({
      name,
      phone: phone || null,
      address: address || null,
      neighborhood: neighborhood.trim() || null,
      city: city.trim() || null,
      state: stateCode.trim().toUpperCase() || null,
      timezone,
    }).eq('id', shop.id)

    if (error) {
      if (import.meta.env.DEV) {
        console.error('[settings][shop-update] failed', {
          shopId: shop.id,
          payload: {
            name,
            phone: phone || null,
            address: address || null,
            neighborhood: neighborhood.trim() || null,
            city: city.trim() || null,
            state: stateCode.trim().toUpperCase() || null,
            timezone,
          },
          error,
        })
      }
      setSaveError(translateError(error.message))
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    await onShopUpdated()
    setTimeout(() => setSuccess(false), 3000)
  }

  function handleAvatarPick(file: File | null) {
    if (!file) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      setAvatarError(validationError)
      return
    }

    setAvatarError('')
    setPendingAvatarFile(file)
    setCropModalOpen(true)
  }

  async function handleAvatarCropped(croppedFile: File) {
    if (!shop || !userId) {
      setAvatarError('Sessão inválida. Faça login novamente para enviar a imagem.')
      return
    }
    setAvatarLoading(true)

    try {
      const newPath = await uploadShopAvatar({
        file: croppedFile,
        userId,
        previousPath: shop.avatar_url,
      })

      const { error } = await supabase
        .from('barbershops')
        .update({ avatar_url: newPath })
        .eq('id', shop.id)

      if (error) throw error

      await onShopUpdated()
      const signed = await getSignedAvatarUrl(SHOP_AVATARS_BUCKET, newPath)
      setAvatarPreview(signed)
      setCropModalOpen(false)
      setPendingAvatarFile(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar imagem'
      setAvatarError(translateError(message))
    } finally {
      setAvatarLoading(false)
    }
  }

  function handleCopyPublicLink() {
    if (!shop) return
    const publicUrl = buildPublicShopUrl(shop.slug)
    navigator.clipboard.writeText(publicUrl)
    setCopiedPublicLink(true)
    setTimeout(() => setCopiedPublicLink(false), 2000)
  }

  const publicShopUrl = shop ? buildPublicShopUrl(shop.slug) : ''

  return (
    <div className="space-y-4">
      {/* Shop media + public URL card */}
      {shop && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Logo da barbearia" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                  <ImageIcon size={22} />
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">Imagem da barbearia</p>
                <p className="text-xs text-[var(--color-text-muted)]">JPG, PNG, WEBP ou GIF. Máximo 2MB.</p>
                <label className="native-upload-trigger">
                  <Upload size={16} />
                  {avatarLoading ? 'Enviando...' : 'Alterar imagem'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={!isAdmin || avatarLoading}
                    onChange={(e) => handleAvatarPick(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            {avatarError && (
              <div className="rounded-lg bg-[var(--color-primary-soft)] p-2 text-xs text-[var(--color-primary)]">{avatarError}</div>
            )}
            <p className="text-sm font-semibold text-[var(--color-text)]">Link público da barbearia</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Compartilhe este link para que clientes visualizem sua página pública e façam agendamentos.
            </p>
            <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
              <div
                title={publicShopUrl}
                className="min-w-0 w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {publicShopUrl}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:grid-cols-none md:flex">
                <button
                  onClick={handleCopyPublicLink}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] md:w-auto"
                >
                  {copiedPublicLink ? <Check size={16} className="text-[var(--color-text)]" /> : <Copy size={16} />}
                  {copiedPublicLink ? 'Copiado!' : 'Copiar'}
                </button>
                <a
                  href={publicShopUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] md:w-auto"
                >
                  <ExternalLink size={16} />
                  Abrir
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Shop info form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveError && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-primary)]">
              {saveError}
            </div>
          )}
          <Input label="Nome da barbearia" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} required />
          <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isAdmin} />
          <Input label="Endereço" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isAdmin} />
          <Input label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} disabled={!isAdmin} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Cidade" value={city} onChange={(e) => setCity(e.target.value)} disabled={!isAdmin} />
            <Select label="UF" value={stateCode} onChange={(e) => setStateCode(e.target.value)} disabled={!isAdmin}>
              <option value="">Não informado</option>
              {BRAZIL_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
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
              {success && <span className="text-sm text-[var(--color-text)]">Salvo com sucesso!</span>}
            </div>
          )}
        </form>
      </Card>

      <AvatarCropModal
        open={cropModalOpen}
        title="Editar logo da barbearia"
        file={pendingAvatarFile}
        loading={avatarLoading}
        error={avatarError}
        onClose={() => {
          if (!avatarLoading) {
            setCropModalOpen(false)
            setPendingAvatarFile(null)
          }
        }}
        onFileChange={handleAvatarPick}
        onConfirm={handleAvatarCropped}
      />
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-[var(--color-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Horários de funcionamento</h2>
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
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 sm:w-40">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!closed}
            onChange={(e) => setClosed(!e.target.checked)}
            disabled={disabled}
            className="native-check"
          />
          <span className={`text-sm font-medium ${closed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'}`}>
            {label}
          </span>
        </label>
      </div>

      {!closed && (
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TimePickerField
            label="Início"
            value={startTime}
            onChange={setStartTime}
            disabled={disabled}
            columns={3}
          />
          <span className="px-1 text-center text-sm text-[var(--color-text-muted)]">até</span>
          <TimePickerField
            label="Fim"
            value={endTime}
            onChange={setEndTime}
            disabled={disabled}
            columns={3}
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Folgas e bloqueios</h2>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openNew}>
              <Plus size={14} /> Novo bloqueio
            </Button>
          )}
        </div>

        {timeOffs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            Nenhum bloqueio cadastrado
          </p>
        ) : (
          <div className="space-y-2">
            {timeOffs.map((to) => (
              <div key={to.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {to.professionals?.name || 'Toda a barbearia'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {format(parseISO(to.start_at), 'dd/MM/yyyy HH:mm')} — {format(parseISO(to.end_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                  {to.reason && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{to.reason}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(to.id)}
                    className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
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
            <div className="rounded-lg bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-primary)]">
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
            <DatePickerField
              label="Data início"
              value={formStartDate}
              onChange={setFormStartDate}
            />
            <TimePickerField
              label="Hora início"
              value={formStartTime}
              onChange={setFormStartTime}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DatePickerField
              label="Data fim"
              value={formEndDate}
              onChange={setFormEndDate}
            />
            <TimePickerField
              label="Hora fim"
              value={formEndTime}
              onChange={setFormEndTime}
            />
          </div>

          <Textarea
            label="Motivo"
            value={formReason}
            onChange={(e) => setFormReason(e.target.value)}
            helperText="Ex: Férias, folga..."
          />

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Membros da equipe</h2>

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {member.user_id.slice(0, 8)}...
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {roleLabels[member.role] || member.role}
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <Select
                  label="Função"
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  className="min-w-[170px]"
                >
                  <option value="admin">Admin</option>
                  <option value="professional">Profissional</option>
                  <option value="reception">Recepção</option>
                </Select>
                <button
                  onClick={() => handleRemove(member.id)}
                  className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
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

