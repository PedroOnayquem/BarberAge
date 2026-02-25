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

export function RegisterClientPage() {
  const { refreshUserData } = useAuth()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [shopSlug, setShopSlug] = useState('')
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

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (!shopSlug.trim()) {
      setError('Informe o codigo da barbearia')
      return
    }

    setLoading(true)

    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('slug', shopSlug.trim().toLowerCase())
      .single()

    if (shopError || !shop) {
      setError('Barbearia nao encontrada. Verifique o codigo informado.')
      setLoading(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      if (authError.status === 429) {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
        if (loginError) {
          setError(translateError(authError.message))
          setLoading(false)
          return
        }
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

    await refreshUserData()
    navigate('/cliente', { replace: true })
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
              label="Codigo da barbearia"
              value={shopSlug}
              onChange={(e) => setShopSlug(e.target.value)}
              required
            />
            <p className="-mt-3 text-xs text-[#6b7a95]">Peca o codigo ao seu barbeiro</p>

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
