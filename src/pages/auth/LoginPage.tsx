import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAuthNextPath, redirectAfterAuth, setLastAuthLoginMode, withAuthNextPath } from '../../lib/authFlow'
import { translateError } from '../../lib/errorMessages'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { AuthCard } from '../../components/auth/AuthCard'
import { FormField } from '../../components/auth/FormField'
import { PrimaryButton } from '../../components/auth/PrimaryButton'

function resolvePostLoginPath(params: {
  hasCompany: boolean
  nextPath: string | null
}) {
  const { hasCompany, nextPath } = params
  if (hasCompany) {
    return nextPath?.startsWith('/app') ? nextPath : '/app/dashboard'
  }
  if (nextPath?.startsWith('/cliente') || nextPath?.startsWith('/empresas')) return nextPath
  return '/cliente/empresas'
}

export function LoginPage() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nextPath = useMemo(() => getAuthNextPath(location.search), [location.search])
  const clientRegisterHref = useMemo(
    () => withAuthNextPath('/cliente/register', nextPath),
    [nextPath]
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Informe seu email')
      return
    }
    if (!password) {
      setError('Informe sua senha')
      return
    }

    setLoading(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const activeEmail = sessionData.session?.user?.email?.trim().toLowerCase() || null
      if (activeEmail && activeEmail !== normalizedEmail) {
        await supabase.auth.signOut()
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError(translateError(signInError.message))
        return
      }

      if (!data.user) {
        setError('Erro ao fazer login')
        return
      }

      const { data: members, error: membersError } = await supabase
        .from('shop_members')
        .select('id')
        .eq('user_id', data.user.id)
        .limit(1)

      if (membersError) {
        setError(translateError(membersError.message || 'Não foi possível validar seu perfil agora.'))
        return
      }

      const hasCompany = Boolean(members && members.length > 0)
      setLastAuthLoginMode(hasCompany ? 'shop' : 'client')
      redirectAfterAuth(resolvePostLoginPath({ hasCompany, nextPath }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthCard
        title="Bem-vindo"
        subtitle="Acesse sua conta"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <p className="text-sm font-semibold text-[var(--color-text)]">Buscar e agendar serviços</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              Entre para explorar empresas locais ou acessar o painel da sua empresa.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-[#ff4d9d]/35 bg-[#ff4d9d]/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <FormField
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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

          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            <Link
              to={clientRegisterHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-3 py-3 text-sm font-semibold text-[var(--color-text)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:bg-white/[0.09]"
            >
              <Search size={15} />
              Criar conta
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-3 py-3 text-sm font-semibold text-[var(--color-text)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:bg-white/[0.09]"
            >
              <Building2 size={15} />
              Cadastrar empresa
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}
