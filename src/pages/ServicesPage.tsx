import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Scissors, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { translateError } from '../lib/errorMessages'
import type { Tables } from '../types/database'

type Service = Tables<'services'>

export function ServicesPage() {
  const { currentShop } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const [formName, setFormName] = useState('')
  const [formDuration, setFormDuration] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (currentShop) loadServices()
  }, [currentShop])

  async function loadServices() {
    if (!currentShop) return
    setLoading(true)
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', currentShop.id)
      .order('name')
    setServices(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditingService(null)
    setFormName('')
    setFormDuration('')
    setFormPrice('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(service: Service) {
    setEditingService(service)
    setFormName(service.name)
    setFormDuration(String(service.duration_minutes))
    setFormPrice(String(service.price))
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentShop) return
    setFormError('')

    const duration = parseInt(formDuration)
    const price = parseFloat(formPrice)

    if (!formName || isNaN(duration) || duration <= 0 || isNaN(price) || price < 0) {
      setFormError('Preencha todos os campos corretamente')
      return
    }

    setFormLoading(true)

    const payload = {
      shop_id: currentShop.id,
      name: formName,
      duration_minutes: duration,
      price,
    }

    if (editingService) {
      const { error } = await supabase.from('services').update(payload).eq('id', editingService.id)
      if (error) { setFormError(translateError(error.message)); setFormLoading(false); return }
    } else {
      const { error } = await supabase.from('services').insert(payload)
      if (error) { setFormError(translateError(error.message)); setFormLoading(false); return }
    }

    setFormLoading(false)
    setModalOpen(false)
    loadServices()
  }

  async function toggleActive(service: Service) {
    await supabase.from('services').update({ active: !service.active }).eq('id', service.id)
    loadServices()
  }

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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Serviços</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os serviços oferecidos
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12">
            <Scissors className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum serviço cadastrado</p>
            <Button className="mt-4" onClick={openNew}>Cadastrar primeiro serviço</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${service.active ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-zinc-100 dark:bg-zinc-700'}`}>
                    <Scissors className={`h-5 w-5 ${service.active ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{service.name}</h3>
                    <Badge variant={service.active ? 'success' : 'default'}>
                      {service.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Duração</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{service.duration_minutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Preço</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">R$ {Number(service.price).toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-700">
                <button
                  onClick={() => toggleActive(service)}
                  className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {service.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                  {service.active ? 'Desativar' : 'Ativar'}
                </button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(service)}>Editar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingService ? 'Editar serviço' : 'Novo serviço'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}
          <Input label="Nome do serviço" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Corte masculino" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Duração (minutos)" type="number" min="1" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} placeholder="30" required />
            <Input label="Preço (R$)" type="number" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="50.00" required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={formLoading}>{editingService ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
