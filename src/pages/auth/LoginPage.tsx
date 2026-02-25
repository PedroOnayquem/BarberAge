import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Armchair, Building2, User, ArrowLeft, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { translateError } from '../../lib/errorMessages'

type LoginMode = 'select' | 'shop' | 'client'

interface PremiumInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

function PremiumInput({ label, value, onChange, type = 'text', ...props }: PremiumInputProps) {
  const [focused, setFocused] = useState(false)
  const hasValue = typeof value === 'string' && value.length > 0
  const floating = focused || hasValue

  return (
    <div className="relative pt-6">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full border-0 border-b border-[#dbe2ec] bg-transparent pb-2.5 text-base text-[#0a1f44] outline-none transition-colors duration-300 focus:border-[#1e3a8a]"
        {...props}
      />
      <label
        className={`pointer-events-none absolute left-0 transition-all duration-200 ${
          floating
            ? 'top-0 text-[11px] font-medium uppercase tracking-[0.14em] text-[#b11226]'
            : 'top-6 text-sm text-[#6b7a95]'
        }`}
      >
        {label}
      </label>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<LoginMode>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f3ee] px-6 py-10">
      <main
        className={`relative z-10 w-full max-w-[540px] rounded-2xl border border-[#dbe2ec] bg-white px-7 py-10 shadow-[0_12px_30px_rgba(10,31,68,0.08)] transition-all duration-700 sm:px-10 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="mb-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#dbe2ec] bg-[#e9eef8] text-[#0a1f44]">
            <Armchair size={30} />
          </div>
          <h1 className="text-[26px] font-semibold uppercase tracking-[0.34em] text-[#0a1f44] sm:text-[30px]">BARBERAGE</h1>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#6b7a95]">Bem-vindo de volta</p>
        </div>

        {mode === 'select' ? (
          <section className="space-y-4">
            <p className="text-center text-sm text-[#6b7a95]">Selecione seu perfil de acesso</p>

            <button
              onClick={() => setMode('shop')}
              className="flex w-full items-center justify-between rounded-xl border border-[#dbe2ec] bg-white px-5 py-4 text-left text-[#0a1f44] transition-all duration-300 hover:border-[#1e3a8a] hover:bg-[#f8fafc]"
            >
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-[#0a1f44]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">Barbearia</p>
                  <p className="text-xs text-[#6b7a95]">Painel administrativo</p>
                </div>
              </div>
              <Sparkles size={15} className="text-[#b11226]" />
            </button>

            <button
              onClick={() => setMode('client')}
              className="flex w-full items-center justify-between rounded-xl border border-[#dbe2ec] bg-white px-5 py-4 text-left text-[#0a1f44] transition-all duration-300 hover:border-[#1e3a8a] hover:bg-[#f8fafc]"
            >
              <div className="flex items-center gap-3">
                <User size={18} className="text-[#0a1f44]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.08em]">Cliente</p>
                  <p className="text-xs text-[#6b7a95]">Agendamento online</p>
                </div>
              </div>
              <Sparkles size={15} className="text-[#b11226]" />
            </button>

            <p className="pt-3 text-center text-xs text-[#6b7a95]">
              Nao tem conta?{' '}
              <Link to="/register" className="font-semibold uppercase tracking-[0.08em] text-[#1e3a8a] hover:text-[#0a1f44]">
                Barbearia
              </Link>
              {' · '}
              <Link to="/cliente/register" className="font-semibold uppercase tracking-[0.08em] text-[#1e3a8a] hover:text-[#0a1f44]">
                Cliente
              </Link>
            </p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-1 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-[#1e3a8a]">{mode === 'shop' ? 'Acesso Barbearia' : 'Acesso Cliente'}</p>
            </div>

            {error && <div className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm text-[#b91c1c]">{error}</div>}

            <PremiumInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <PremiumInput
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 w-full overflow-hidden rounded-xl bg-[#b11226] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition-all duration-300 hover:bg-[#8f0e1f] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.38),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">{loading ? 'Entrando...' : 'Entrar'}</span>
            </button>

            <p className="text-center text-xs text-[#6b7a95]">
              Nao tem conta?{' '}
              {mode === 'shop' ? (
                <Link to="/register" className="font-semibold uppercase tracking-[0.08em] text-[#1e3a8a] hover:text-[#0a1f44]">
                  Criar conta
                </Link>
              ) : (
                <Link to="/cliente/register" className="font-semibold uppercase tracking-[0.08em] text-[#1e3a8a] hover:text-[#0a1f44]">
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
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7a95] transition-colors hover:text-[#0a1f44]"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
