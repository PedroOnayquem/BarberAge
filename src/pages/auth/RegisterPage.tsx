import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { redirectAfterAuth, setLastAuthLoginMode } from '../../lib/authFlow'
import { translateError } from '../../lib/errorMessages'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthCard } from '../../components/auth/AuthCard'
import { FormField } from '../../components/auth/FormField'
import { PrimaryButton } from '../../components/auth/PrimaryButton'

function isAlreadyRegisteredError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('já está cadastrado')
  )
}

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

    const normalizedEmail = email.trim().toLowerCase()
    const shopMetadata = {
      role: 'shop',
      account_type: 'shop',
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: shopMetadata },
    })

    if (error) {
      const canLoginFallback = error.status === 429 || isAlreadyRegisteredError(error.message)

      if (canLoginFallback) {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (!loginError) {
          if (loginData.user) {
            await supabase.auth.updateUser({ data: shopMetadata })
          }
          setLastAuthLoginMode('shop')
          redirectAfterAuth('/create-shop')
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

    if (data.session) {
      setLastAuthLoginMode('shop')
      redirectAfterAuth('/create-shop')
      return
    }

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })
    if (!loginError) {
      if (loginData.user) {
        await supabase.auth.updateUser({ data: shopMetadata })
      }
      setLastAuthLoginMode('shop')
      redirectAfterAuth('/create-shop')
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <AuthLayout>
      <AuthCard
        icon={
          success
            ? <CheckCircle size={30} />
            : <img src="/apple-touch-icon.png" alt="Ícone BarberAge" className="h-8 w-8 object-contain" />
        }
        title="BARBERAGE"
        subtitle={success ? 'Verifique seu email' : 'Cadastro Barbearia'}
      >
        {success ? (
          <section className="space-y-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Enviamos um link de confirmacao para <strong className="text-[var(--color-text)]">{email}</strong>. Clique no
              link para ativar sua conta.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <ArrowLeft size={14} />
              Voltar para o login
            </Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}

            <FormField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <FormField
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <FormField
              label="Confirmar senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <PrimaryButton
              type="submit"
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </PrimaryButton>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Ja tem conta?{' '}
              <Link
                to="/register"
                className="font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] hover:text-[var(--color-text)]"
              >
                Entrar
              </Link>
            </p>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  )
}
