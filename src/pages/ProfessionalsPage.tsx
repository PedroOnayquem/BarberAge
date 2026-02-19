import { useEffect, useState, type FormEvent } from 'react'
import { Plus, UserCog, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { translateError } from '../lib/errorMessages'
import type { Tables } from '../types/database'

type Professional = Tables<'professionals'>

export function ProfessionalsPage() {
  const { currentShop } = useAuth()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null)

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (currentShop) loadProfessionals()
  }, [currentShop])

  async function loadProfessionals() {
    if (!currentShop) return
    setLoading(true)
    const { data } = await supabase
      .from('professionals')
      .select('*')
      .eq('shop_id', currentShop.id)
      .order('name')
    setProfessionals(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditingProfessional(null)
    setFormName('')
    setFormPhone('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(prof: Professional) {
    setEditingProfessional(prof)
    setFormName(prof.name)
    setFormPhone(prof.phone || '')
    setFormError('')
    setModalOpen(true)
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
    }

    if (editingProfessional) {
      const { error } = await supabase.from('professionals').update(payload).eq('id', editingProfessional.id)
      if (error) { setFormError(translateError(error.message)); setFormLoading(false); return }
    } else {
      const { error } = await supabase.from('professionals').insert(payload)
      if (error) { setFormError(translateError(error.message)); setFormLoading(false); return }
    }

    setFormLoading(false)
    setModalOpen(false)
    loadProfessionals()
  }

  async function toggleActive(prof: Professional) {
    await supabase.from('professionals').update({ active: !prof.active }).eq('id', prof.id)
    loadProfessionals()
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Profissionais</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie os barbeiros e profissionais
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Novo profissional
        </Button>
      </div>

      {professionals.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-12">
            <UserCog className="mb-3 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum profissional cadastrado</p>
            <Button className="mt-4" onClick={openNew}>Cadastrar primeiro profissional</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((prof) => (
            <Card key={prof.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
                    prof.active
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'
                  }`}>
                    {prof.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{prof.name}</h3>
                    {prof.phone && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{prof.phone}</p>
                    )}
                  </div>
                </div>
                <Badge variant={prof.active ? 'success' : 'default'}>
                  {prof.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-700">
                <button
                  onClick={() => toggleActive(prof)}
                  className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {prof.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                  {prof.active ? 'Desativar' : 'Ativar'}
                </button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(prof)}>Editar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingProfessional ? 'Editar profissional' : 'Novo profissional'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}
          <Input label="Nome" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do profissional" required />
          <Input label="Telefone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 99999-9999" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={formLoading}>{editingProfessional ? 'Salvar' : 'Cadastrar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
