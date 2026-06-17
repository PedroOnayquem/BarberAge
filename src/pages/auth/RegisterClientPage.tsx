import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import type { User as AuthUser } from '@supabase/supabase-js'
import { Link, useLocation } from 'react-router-dom'
import { User as UserIcon, CheckCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  getAuthNextPath,
  redirectAfterAuth,
  setLastAuthLoginMode,
  withAuthNextPath,
} from '../../lib/authFlow'
import { upsertClientGlobalProfile } from '../../lib/clientProfiles'
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
  const location = useLocation()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nextPath = useMemo(() => getAuthNextPath(location.search), [location.search])
  const loginHref = useMemo(() => withAuthNextPath('/login', nextPath), [nextPath])

  async function finalizeClientAuth(params: {
    authUser: AuthUser
    metadata: Record<string, string>
    normalizedName: string
    normalizedPhone: string
    normalizedEmail: string
  }) {
    const { authUser, metadata, normalizedName, normalizedPhone, normalizedEmail } = params

    const { error: updateUserError } = await supabase.auth.updateUser({ data: metadata })
    if (updateUserError) throw updateUserError

    await upsertClientGlobalProfile({
      userId: authUser.id,
      name: normalizedName,
      phone: normalizedPhone || null,
      email: normalizedEmail || authUser.email || null,
    })

    setLastAuthLoginMode('client')
    redirectAfterAuth(nextPath || '/cliente/empresas')
  }

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
            await finalizeClientAuth({
              authUser: loginData.user,
              metadata,
              normalizedName,
              normalizedPhone,
              normalizedEmail,
            })
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

        await finalizeClientAuth({
          authUser: loginData.user,
          metadata,
          normalizedName,
          normalizedPhone,
          normalizedEmail,
        })
        return
      }

      if (!signUpResult.data.user) {
        setError('Erro ao criar conta')
        return
      }

      await finalizeClientAuth({
        authUser: signUpResult.data.user,
        metadata,
        normalizedName,
        normalizedPhone,
        normalizedEmail,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthCard
        icon={step === 'success' ? <CheckCircle size={30} /> : <UserIcon size={30} />}
        title={step === 'success' ? 'Quase lá' : 'Criar conta'}
        subtitle={step === 'success' ? 'Verifique seu email' : 'Busque empresas locais e agende serviços'}
      >
        {step === 'success' ? (
          <section className="space-y-6 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Enviamos um link de confirmacao para <strong className="text-[var(--color-text)]">{email}</strong>. Clique no
              link para ativar sua conta.
            </p>
            <Link
              to={loginHref}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              <ArrowLeft size={14} />
              Voltar para o login
            </Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-[#ff4d9d]/35 bg-[#ff4d9d]/10 px-3 py-2 text-sm text-red-100">
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
                to={loginHref}
                className="font-semibold text-[var(--color-accent)] hover:text-[var(--color-text)]"
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
