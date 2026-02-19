import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Armchair, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { translateError } from '../../lib/errorMessages'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      // If rate limited (429), the user may already exist from a previous attempt.
      // Try logging in directly since our DB trigger auto-confirms users.
      if (error.status === 429) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (!loginError) {
          window.location.href = '/create-shop'
          return
        }
        setError(translateError(error.message))
        setLoading(false)
        return
      }

      setError(translateError(error.message))
      setLoading(false)
      return
    }

    // If session exists immediately (auto-confirm trigger worked), redirect
    if (data.session) {
      window.location.href = '/create-shop'
      return
    }

    // User created but no session yet — try logging in (trigger should have confirmed)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (!loginError) {
      window.location.href = '/create-shop'
      return
    }

    // Fallback: show email verification message
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
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
              className="mt-6 inline-block text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500"
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <Armchair className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Criar conta</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Comece a gerenciar sua barbearia</p>
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

          <Input
            label="Confirmar senha"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <Button type="submit" loading={loading} className="w-full">
            Cadastrar
          </Button>

          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Já tem conta?{' '}
            <Link to="/login" className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
