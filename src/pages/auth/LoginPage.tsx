import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, User, ArrowLeft, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { translateError } from '../../lib/errorMessages'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthCard } from '../../components/auth/AuthCard'
import { FormField } from '../../components/auth/FormField'
import { PrimaryButton } from '../../components/auth/PrimaryButton'

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

    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
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
    } else {
      const userMeta = (data.user.user_metadata || {}) as Record<string, unknown>
      const isClientByMetadata =
        userMeta.role === 'client' || userMeta.account_type === 'client'

      if (!isClientByMetadata) {
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
      }

      navigate('/cliente')
    }

    setLoading(false)
  }

  const subtitle =
    mode === 'select'
      ? 'Selecione seu perfil'
      : mode === 'shop'
        ? 'Acesso Barbearia'
        : 'Acesso Cliente'

  return (
    <AuthLayout>
      <AuthCard
        icon={<img src="/apple-touch-icon.png" alt="Ícone BarberAge" className="h-8 w-8 object-contain" />}
        title="BARBERAGE"
        subtitle={subtitle}
      >
        {mode === 'select' ? (
          <section className="space-y-4">
            <p className="text-center text-sm text-[var(--color-text-muted)]">Selecione seu perfil de acesso</p>

            <button
              onClick={() => setMode('shop')}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-4 text-left text-[var(--color-text)] transition-all duration-200 hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-muted)]"
            >
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-[var(--color-text)]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">Barbearia</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Painel administrativo</p>
                </div>
              </div>
              <Sparkles size={15} className="text-[var(--color-primary)]" />
            </button>

            <button
              onClick={() => setMode('client')}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-4 text-left text-[var(--color-text)] transition-all duration-200 hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-muted)]"
            >
              <div className="flex items-center gap-3">
                <User size={18} className="text-[var(--color-text)]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">Cliente</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Agendamento online</p>
                </div>
              </div>
              <Sparkles size={15} className="text-[var(--color-primary)]" />
            </button>

            <p className="pt-3 text-center text-xs text-[var(--color-text-muted)]">
              Nao tem conta?{' '}
              <Link
                to="/register"
                className="font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] hover:text-[var(--color-text)]"
              >
                Barbearia
              </Link>
              {' · '}
              <Link
                to="/cliente/register"
                className="font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] hover:text-[var(--color-text)]"
              >
                Cliente
              </Link>
            </p>
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
              autoComplete="current-password"
              required
            />

            <PrimaryButton
              type="submit"
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </PrimaryButton>

            <p className="text-center text-xs text-[var(--color-text-muted)]">
              Nao tem conta?{' '}
              {mode === 'shop' ? (
                <Link
                  to="/register"
                  className="font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] hover:text-[var(--color-text)]"
                >
                  Criar conta
                </Link>
              ) : (
                <Link
                  to="/cliente/register"
                  className="font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] hover:text-[var(--color-text)]"
                >
                  Criar conta
                </Link>
              )}
            </p>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('select')
                  setError('')
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  )
}
