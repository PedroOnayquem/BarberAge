import { useState, type FormEvent } from 'react'
import { Armchair } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { translateError } from '../../lib/errorMessages'

export function CreateShopPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function generateSlug(text: string) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setLoading(true)

    const slug = generateSlug(name) + '-' + Date.now().toString(36)

    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .insert({ name, slug, phone: phone || null, address: address || null })
      .select()
      .single()

    if (shopError) {
      setError(translateError(shopError.message))
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase
      .from('shop_members')
      .insert({ shop_id: shop.id, user_id: user.id, role: 'admin' })

    if (memberError) {
      setError(translateError(memberError.message))
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <Armchair className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Criar barbearia</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Configure sua barbearia para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Input
            label="Nome da barbearia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Barbearia do João"
            required
          />

          <Input
            label="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
          />

          <Input
            label="Endereço"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número, bairro"
          />

          <Button type="submit" loading={loading} className="w-full">
            Criar barbearia
          </Button>
        </form>
      </div>
    </div>
  )
}
