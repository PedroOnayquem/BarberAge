import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, CheckCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { translateError } from '../../lib/errorMessages'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone, normalizePhone } from '../../lib/phone'
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
  const navigate = useNavigate()

  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value
    const currentCaret = e.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, currentCaret)
    const formattedValue = formatPhone(rawValue)
    const nextCaret = caretIndexFromDigitCount(formattedValue, digitsBeforeCaret)

    setPhone(formattedValue)

    requestAnimationFrame(() => {
      e.target.setSelectionRange(nextCaret, nextCaret)
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const normalizedName = name.trim()
    const normalizedPhone = normalizePhone(phone)
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
    <AuthLayout>
      <AuthCard
        icon={step === 'success' ? <CheckCircle size={30} /> : <User size={30} />}
        title="BARBERAGE"
        subtitle={step === 'success' ? 'Verifique seu email' : 'Cadastro Cliente'}
      >
        {step === 'success' ? (
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
              label="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <FormField
              label="Telefone"
              value={phone}
              onChange={handlePhoneChange}
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
            />

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
