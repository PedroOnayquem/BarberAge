import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { User, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { translateError } from '../../lib/errorMessages'

export function RegisterClientPage() {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [shopSlug, setShopSlug] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (!shopSlug.trim()) {
      setError('Informe o código da barbearia')
      return
    }

    setLoading(true)

    // 1. Find the shop by slug
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('slug', shopSlug.trim().toLowerCase())
      .single()

    if (shopError || !shop) {
      setError('Barbearia não encontrada. Verifique o código informado.')
      setLoading(false)
      return
    }

    // 2. Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      if (authError.status === 429) {
        // Rate limited — try login (user may already exist)
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError) {
          setError(translateError(authError.message))
          setLoading(false)
          return
        }
        // User exists, continue with linking
        await linkClientToShop(loginData.user!.id, shop.id, name, phone, email)
        return
      }
      setError(translateError(authError.message))
      setLoading(false)
      return
    }

    const userId = authData.user?.id
    if (!userId) {
      setError('Erro ao criar conta')
      setLoading(false)
      return
    }

    // Try to sign in (auto-confirm trigger should have confirmed)
    if (!authData.session) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) {
        setStep('success')
        setLoading(false)
        return
      }
    }

    await linkClientToShop(userId, shop.id, name, phone, email)
  }

  async function linkClientToShop(_userId: string, shopId: string, clientName: string, clientPhone: string, clientEmail: string) {
    // Use RPC to atomically create client + link (bypasses RLS issues)
    const { error: rpcError } = await supabase.rpc('register_client', {
      p_shop_id: shopId,
      p_name: clientName,
      p_phone: clientPhone || null,
      p_email: clientEmail || null,
    })

    if (rpcError) {
      setError(translateError(rpcError.message))
      setLoading(false)
      return
    }

    window.location.href = '/cliente'
  }

  if (step === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Verifique seu email</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Enviamos um link de confirmação para <strong className="text-zinc-700 dark:text-zinc-200">{email}</strong>.
              Clique no link para ativar sua conta.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
            <User className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Cadastro de Cliente</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Crie sua conta para agendar serviços</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Input
            label="Código da barbearia"
            value={shopSlug}
            onChange={(e) => setShopSlug(e.target.value)}
            placeholder="ex: barbearia-do-joao-abc123"
            required
          />
          <p className="-mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            Peça o código ao seu barbeiro
          </p>

          <Input label="Seu nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" required />
          <Input label="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          <Input label="Confirmar senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />

          <Button type="submit" loading={loading} className="w-full">
            Cadastrar
          </Button>

          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
