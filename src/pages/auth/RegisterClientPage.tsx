import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, CheckCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { translateError } from '../../lib/errorMessages'

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

function isAlreadyRegisteredError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('já está cadastrado')
  )
}

function shouldRetrySignUpWithoutMetadata(status?: number, message?: string): boolean {
  if (status !== 422) return false
  const normalized = (message || '').toLowerCase()
  return (
    normalized.includes('metadata') ||
    normalized.includes('unprocessable') ||
    normalized.includes('invalid request') ||
    normalized.includes('payload')
  )
}

export function RegisterClientPage() {
  const { refreshUserData } = useAuth()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const normalizedName = name.trim()
    const normalizedPhone = phone.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedName) {
      setError('Informe seu nome')
      return
    }

    if (!normalizedEmail) {
      setError('Informe seu email')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    const metadata: Record<string, string> = {
      role: 'client',
      account_type: 'client',
      name: normalizedName,
    }
    if (normalizedPhone) {
      metadata.phone = normalizedPhone
    }

    setLoading(true)
    try {
      let signUpResult = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: metadata,
        },
      })

      if (signUpResult.error && shouldRetrySignUpWithoutMetadata(signUpResult.error.status, signUpResult.error.message)) {
        signUpResult = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        })
      }

      if (signUpResult.error) {
        if (import.meta.env.DEV) {
          console.error('[register-client] signUp failed', {
            status: signUpResult.error.status,
            code: signUpResult.error.code,
            message: signUpResult.error.message,
          })
        }

        const canLoginFallback =
          signUpResult.error.status === 429 || isAlreadyRegisteredError(signUpResult.error.message)

        if (canLoginFallback) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          })
          if (!loginError && loginData.user) {
            await supabase.auth.updateUser({ data: metadata })
            await refreshUserData()
            navigate('/cliente/barbearias', { replace: true })
            return
          }
        }

        setError(translateError(signUpResult.error.message))
        return
      }

      const userId = signUpResult.data.user?.id
      if (!userId) {
        setError('Erro ao criar conta')
        return
      }

      if (!signUpResult.data.session) {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })
        if (loginError || !loginData.user) {
          setStep('success')
          return
        }

        await supabase.auth.updateUser({ data: metadata })
        await refreshUserData()
        navigate('/cliente/barbearias', { replace: true })
        return
      }

      await supabase.auth.updateUser({ data: metadata })
      await refreshUserData()
      navigate('/cliente/barbearias', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f3ee] px-6 py-10">
      <main
        className={`relative z-10 w-full max-w-[580px] rounded-2xl border border-[#dbe2ec] bg-white px-7 py-10 shadow-[0_12px_30px_rgba(10,31,68,0.08)] transition-all duration-700 sm:px-10 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="mb-12 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#dbe2ec] bg-[#e9eef8] text-[#0a1f44]">
            {step === 'success' ? <CheckCircle size={30} /> : <User size={30} />}
          </div>
          <h1 className="text-[26px] font-semibold uppercase tracking-[0.34em] text-[#0a1f44] sm:text-[30px]">BARBERAGE</h1>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#6b7a95]">
            {step === 'success' ? 'Verifique seu email' : 'Cadastro Cliente'}
          </p>
        </div>

        {step === 'success' ? (
          <section className="space-y-6 text-center">
            <p className="text-sm text-[#425a7f]">
              Enviamos um link de confirmação para <strong className="text-[#0a1f44]">{email}</strong>. Clique no link para ativar sua conta.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7a95] transition-colors hover:text-[#0a1f44]"
            >
              <ArrowLeft size={14} />
              Voltar para o login
            </Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm text-[#b91c1c]">{error}</div>}

            <PremiumInput
              label="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <PremiumInput
              label="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

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
              autoComplete="new-password"
              required
            />

            <PremiumInput
              label="Confirmar senha"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="group relative mt-2 w-full overflow-hidden rounded-xl bg-[#b11226] px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition-all duration-300 hover:bg-[#8f0e1f] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.38),transparent)] transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">{loading ? 'Cadastrando...' : 'Cadastrar'}</span>
            </button>

            <p className="text-center text-xs text-[#6b7a95]">
              Ja tem conta?{' '}
              <Link to="/login" className="font-semibold uppercase tracking-[0.08em] text-[#1e3a8a] hover:text-[#0a1f44]">
                Entrar
              </Link>
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
