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

    window.location.href = '/app'
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdecef]">
            <Armchair className="h-8 w-8 text-[#b11226]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0a1f44]">Criar barbearia</h1>
          <p className="mt-1 text-sm text-[#6b7a95]">Configure sua barbearia para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#dbe2ec] bg-white p-6 shadow-sm">
          {error && (
            <div className="rounded-lg bg-[#fdecef] p-3 text-sm text-[#b11226]">
              {error}
            </div>
          )}

          <Input
            label="Nome da barbearia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            helperText="Ex: Barbearia do João"
            required
          />

          <Input
            label="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            helperText="(11) 99999-9999"
          />

          <Input
            label="Endereço"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            helperText="Rua, número, bairro"
          />

          <Button type="submit" loading={loading} className="w-full">
            Criar barbearia
          </Button>
        </form>
      </div>
    </div>
  )
}

