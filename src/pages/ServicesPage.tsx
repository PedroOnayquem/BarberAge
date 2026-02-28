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
    const normalizedName = formName.trim().replace(/\s+/g, ' ')

    if (!normalizedName || isNaN(duration) || duration <= 0 || isNaN(price) || price < 0) {
      setFormError('Preencha todos os campos corretamente')
      return
    }

    const hasDuplicateName = services.some((s) => {
      if (editingService && s.id === editingService.id) return false
      return s.name.trim().toLowerCase() === normalizedName.toLowerCase()
    })

    if (hasDuplicateName) {
      setFormError('Já existe um serviço com esse nome na sua barbearia.')
      return
    }

    setFormLoading(true)

    const payload = {
      shop_id: currentShop.id,
      name: normalizedName,
      duration_minutes: duration,
      price,
    }

    if (editingService) {
      const { error } = await supabase.from('services').update(payload).eq('id', editingService.id)
      if (error) {
        if (error.code === '23505' || error.message.includes('services_shop_id_name_key')) {
          setFormError('Já existe um serviço com esse nome na sua barbearia.')
        } else {
          setFormError(translateError(error.message))
        }
        setFormLoading(false)
        return
      }
    } else {
      const { error } = await supabase.from('services').insert(payload)
      if (error) {
        if (error.code === '23505' || error.message.includes('services_shop_id_name_key')) {
          setFormError('Já existe um serviço com esse nome na sua barbearia.')
        } else {
          setFormError(translateError(error.message))
        }
        setFormLoading(false)
        return
      }
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Serviços</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
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
            <Scissors className="mb-3 h-12 w-12 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">Nenhum serviço cadastrado</p>
            <Button className="mt-4" onClick={openNew}>Cadastrar primeiro serviço</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${service.active ? 'bg-[var(--color-primary-soft)]' : 'bg-[var(--color-surface-muted)]'}`}>
                    <Scissors className={`h-5 w-5 ${service.active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-text)]">{service.name}</h3>
                    <Badge variant={service.active ? 'success' : 'default'}>
                      {service.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Duração</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{service.duration_minutes} min</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Preço</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">R$ {Number(service.price).toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={() => toggleActive(service)}
                  className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  {service.active ? <ToggleRight size={18} className="text-[var(--color-text)]" /> : <ToggleLeft size={18} />}
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
            <div className="rounded-lg bg-[var(--color-primary-soft)] p-3 text-sm text-[var(--color-primary)]">
              {formError}
            </div>
          )}
          <Input label="Nome do serviço" value={formName} onChange={(e) => setFormName(e.target.value)} helperText="Ex: Corte masculino" required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Duração (minutos)" type="number" min="1" value={formDuration} onChange={(e) => setFormDuration(e.target.value)} helperText="30" required />
            <Input label="Preço (R$)" type="number" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} helperText="50.00" required />
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={formLoading}>{editingService ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}


