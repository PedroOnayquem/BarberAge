import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Plus, Phone, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { format, parseISO } from 'date-fns'
import { translateError } from '../lib/errorMessages'
import { CLIENT_AVATARS_BUCKET, getSignedAvatarUrl } from '../lib/avatarStorage'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone, normalizePhone } from '../lib/phone'
import type { Tables } from '../types/database'

type Client = Tables<'clients'>

interface ClientWithCount extends Client {
  appointment_count: number
}

export function ClientsPage() {
  const { currentShop } = useAuth()
  const [clients, setClients] = useState<ClientWithCount[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [clientAppointments, setClientAppointments] = useState<any[]>([])
  const [avatarByClientId, setAvatarByClientId] = useState<Record<string, string>>({})

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (currentShop) loadClients()
  }, [currentShop])

  async function loadClients() {
    if (!currentShop) return
    setLoading(true)

    const { data } = await supabase
      .from('clients')
      .select('*, appointments(id)')
      .eq('shop_id', currentShop.id)
      .order('name')

    const clientsWithCount = (data || []).map((c: any) => ({
      ...c,
      appointment_count: c.appointments?.length || 0,
      appointments: undefined,
    }))

    setClients(clientsWithCount)
    await loadClientAvatars(clientsWithCount)
    setLoading(false)
  }

  async function loadClientAvatars(rows: ClientWithCount[]) {
    const entries = await Promise.all(
      rows.map(async (client) => {
        const signed = await getSignedAvatarUrl(CLIENT_AVATARS_BUCKET, client.avatar_url)
        return [client.id, signed] as const
      })
    )
    const map: Record<string, string> = {}
    entries.forEach(([id, signed]) => {
      if (signed) map[id] = signed
    })
    setAvatarByClientId(map)
  }

  function openNew() {
    setEditingClient(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormError('')
    setModalOpen(true)
  }

  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value
    const currentCaret = e.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, currentCaret)
    const formattedValue = formatPhone(rawValue)
    const nextCaret = caretIndexFromDigitCount(formattedValue, digitsBeforeCaret)

    setFormPhone(formattedValue)

    requestAnimationFrame(() => {
      e.target.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setFormName(client.name)
    setFormPhone(formatPhone(client.phone || ''))
    setFormEmail(client.email || '')
    setFormError('')
    setModalOpen(true)
  }

  async function openDetail(client: Client) {
    setDetailClient(client)
    setDetailModalOpen(true)

    const { data } = await supabase
      .from('appointments')
      .select('*, professionals(name), appointment_services(services(name))')
      .eq('client_id', client.id)
      .order('start_at', { ascending: false })
      .limit(20)

    setClientAppointments(data || [])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentShop) return
    setFormError('')
    setFormLoading(true)

    const normalizedPhone = normalizePhone(formPhone)

    const payload = {
      shop_id: currentShop.id,
      name: formName,
      phone: normalizedPhone || null,
      email: formEmail || null,
    }

    if (editingClient) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id)
      if (error) { setFormError(translateError(error.message)); setFormLoading(false); return }
    } else {
      const { error } = await supabase.from('clients').insert(payload)
      if (error) { setFormError(translateError(error.message)); setFormLoading(false); return }
    }

    setFormLoading(false)
    setModalOpen(false)
    loadClients()
  }

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    normalizePhone(c.phone || '').includes(normalizePhone(search)) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Clientes</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {clients.length} clientes cadastrados
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo cliente
        </Button>
      </div>

      <Input
        label="Buscar clientes"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            Nenhum cliente encontrado
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Card key={client.id} className="cursor-pointer transition-shadow hover:shadow-md">
              <div onClick={() => openDetail(client)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {avatarByClientId[client.id] ? (
                      <img
                        src={avatarByClientId[client.id]}
                        alt={`Avatar de ${client.name}`}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-xs font-bold text-[var(--color-text)]">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h3 className="font-semibold text-[var(--color-text)]">{client.name}</h3>
                  </div>
                  <Badge>{client.appointment_count} agend.</Badge>
                </div>
                <div className="mt-3 space-y-1">
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                      <Phone size={14} /> {formatPhone(client.phone)}
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                      <Mail size={14} /> {client.email}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                  Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingClient ? 'Editar cliente' : 'Novo cliente'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-primary)]">
              {formError}
            </div>
          )}
          <Input label="Nome" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          <Input
            label="Telefone"
            value={formPhone}
            onChange={handlePhoneChange}
            helperText="(11) 99999-9999"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={15}
          />
          <Input label="Email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} helperText="email@exemplo.com" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={formLoading}>{editingClient ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={detailClient?.name || 'Cliente'} size="lg">
        {detailClient && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-text-muted)]">Telefone</p>
                <p className="font-medium text-[var(--color-text)]">{detailClient.phone ? formatPhone(detailClient.phone) : '—'}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Email</p>
                <p className="font-medium text-[var(--color-text)]">{detailClient.email || '—'}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Cadastrado em</p>
                <p className="font-medium text-[var(--color-text)]">
                  {format(parseISO(detailClient.created_at), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-[var(--color-text)]">Histórico de agendamentos</h3>
              {clientAppointments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nenhum agendamento</p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {clientAppointments.map((apt: any) => (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] p-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          {format(parseISO(apt.start_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {apt.professionals?.name} • {apt.appointment_services?.map((as_: any) => as_.services?.name).filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <Badge variant={apt.status === 'completed' ? 'success' : apt.status === 'cancelled' ? 'danger' : 'default'}>
                        {apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}



