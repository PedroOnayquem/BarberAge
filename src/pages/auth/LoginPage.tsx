import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Armchair, Building2, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { translateError } from '../../lib/errorMessages'

type LoginMode = 'select' | 'shop' | 'client'

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<LoginMode>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(translateError(error.message))
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Erro ao fazer login')
      setLoading(false)
      return
    }

    if (mode === 'shop') {
      // Check if user is a shop member
      const { data: members } = await supabase
        .from('shop_members')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1)

      if (!members || members.length === 0) {
        setError('Esta conta não está vinculada a nenhuma barbearia. Cadastre-se como barbearia primeiro.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
      // AuthContext will handle the redirect
    } else {
      // Client login — check if user is a client
      const { data: clientUsers } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1)

      if (!clientUsers || clientUsers.length === 0) {
        setError('Esta conta não está cadastrada como cliente. Cadastre-se primeiro.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
      navigate('/cliente')
    }

    setLoading(false)
  }

  if (mode === 'select') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
              <Armchair className="h-8 w-8 text-amber-600 dark:text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">BarberAge</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Como deseja entrar?</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode('shop')}
              className="flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-amber-600"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Building2 className="h-6 w-6 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Entrar como Barbearia</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Acesse o painel administrativo</p>
              </div>
            </button>

            <button
              onClick={() => setMode('client')}
              className="flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition-all hover:border-amber-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-amber-600"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <User className="h-6 w-6 text-emerald-600 dark:text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">Entrar como Cliente</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Agende serviços na sua barbearia</p>
              </div>
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500">
              Cadastre-se como barbearia
            </Link>
            {' · '}
            <Link to="/cliente/register" className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500">
              Cadastre-se como cliente
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
            mode === 'shop'
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-emerald-100 dark:bg-emerald-900/30'
          }`}>
            {mode === 'shop'
              ? <Building2 className="h-8 w-8 text-amber-600 dark:text-amber-500" />
              : <User className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
            }
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {mode === 'shop' ? 'Acesso Barbearia' : 'Acesso Cliente'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Entre na sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />

          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setMode('select'); setError('') }}
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              ← Voltar
            </button>
            {mode === 'shop' ? (
              <Link to="/register" className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500">
                Criar conta
              </Link>
            ) : (
              <Link to="/cliente/register" className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500">
                Criar conta
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
