import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Search, Phone, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { format, parseISO } from 'date-fns'
import { translateError } from '../lib/errorMessages'
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
    setLoading(false)
  }

  function openNew() {
    setEditingClient(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setFormName(client.name)
    setFormPhone(client.phone || '')
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

    const payload = {
      shop_id: currentShop.id,
      name: formName,
      phone: formPhone || null,
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
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {clients.length} clientes cadastrados
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Nenhum cliente encontrado
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Card key={client.id} className="cursor-pointer transition-shadow hover:shadow-md">
              <div onClick={() => openDetail(client)}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{client.name}</h3>
                  <Badge>{client.appointment_count} agend.</Badge>
                </div>
                <div className="mt-3 space-y-1">
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <Phone size={14} /> {client.phone}
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
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
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}
          <Input label="Nome" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          <Input label="Telefone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 99999-9999" />
          <Input label="Email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
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
                <p className="text-zinc-500 dark:text-zinc-400">Telefone</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{detailClient.phone || '—'}</p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Email</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{detailClient.email || '—'}</p>
              </div>
              <div>
                <p className="text-zinc-500 dark:text-zinc-400">Cadastrado em</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {format(parseISO(detailClient.created_at), 'dd/MM/yyyy')}
                </p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">Histórico de agendamentos</h3>
              {clientAppointments.length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum agendamento</p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {clientAppointments.map((apt: any) => (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-700">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {format(parseISO(apt.start_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
