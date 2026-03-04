import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { CheckCircle2, Scissors } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { translateError } from '../../../lib/errorMessages'
import { buildAddressLine, normalizeCep } from '../../../lib/location'
import { caretIndexFromDigitCount, countDigitsBeforeCaret, formatPhone, normalizePhone } from '../../../lib/phone'
import { supabase } from '../../../lib/supabase'
import { uploadShopAvatar } from '../../../lib/avatarStorage'
import { Step1Account } from './Step1Account'
import { Step1BusinessType } from './Step1BusinessType'
import { Step2Location } from './Step2Location'
import { Step3Owner } from './Step3Owner'
import { Step4Operation } from './Step4Operation'
import { Step5Review } from './Step5Review'
import {
  TOTAL_WIZARD_STEPS,
  useWizardState,
  validateAllSteps,
  validateStep,
  type WizardData,
  type WizardStep,
} from './useWizardState'

type SupabaseMutationError = {
  message?: string
  details?: string
  hint?: string
  code?: string
  status?: number
} | null

type InsertMode = 'extended' | 'full' | 'legacy'
type InsertRelation = 'barbershops' | 'shops'

interface InsertAttempt {
  relation: InsertRelation
  mode: InsertMode
  payload: Record<string, unknown>
}

interface InsertResult {
  relation: InsertRelation
  mode: InsertMode
  row: Record<string, unknown>
}

const STEP_COPY: Record<WizardStep, { title: string; subtitle: string }> = {
  1: {
    title: 'Crie sua conta de acesso',
    subtitle: 'Use email e senha para iniciar seu cadastro de barbearia.',
  },
  2: {
    title: 'Que tipo de barbearia e a sua?',
    subtitle: 'Selecione a opcao que melhor representa seu negocio.',
  },
  3: {
    title: 'Onde fica sua barbearia?',
    subtitle: 'Digite o CEP e complete as informacoes.',
  },
  4: {
    title: 'Dados do responsavel',
    subtitle: 'Esses dados serao usados para contato e administracao.',
  },
  5: {
    title: 'Como sua barbearia funciona?',
    subtitle: 'Defina capacidade, intervalo e horario inicial.',
  },
  6: {
    title: 'Revise seus dados',
    subtitle: 'Confira tudo antes de finalizar o cadastro.',
  },
}

function isAlreadyRegisteredError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('ja esta cadastrado')
  )
}

function sanitizePayload(payload: Record<string, unknown>) {
  const normalized = Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined) return acc
    acc[key] = value
    return acc
  }, {})
  return normalized
}

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function isSchemaCompatibilityError(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('schema cache') ||
    normalized.includes('does not exist') ||
    normalized.includes('column') ||
    normalized.includes('pgrst204')
  )
}

async function tryInsert(attempt: InsertAttempt): Promise<{ row: Record<string, unknown> | null; error: SupabaseMutationError }> {
  const { data, error } = await supabase
    .from(attempt.relation)
    .insert(attempt.payload as never)
    .select('*')
    .maybeSingle()

  return {
    row: (data as Record<string, unknown> | null) || null,
    error: (error as SupabaseMutationError) || null,
  }
}

async function insertShopWithFallback(attempts: InsertAttempt[]): Promise<InsertResult> {
  let lastError: SupabaseMutationError = null

  for (const attempt of attempts) {
    const result = await tryInsert(attempt)
    if (!result.error && result.row) {
      return {
        relation: attempt.relation,
        mode: attempt.mode,
        row: result.row,
      }
    }

    lastError = result.error
    if (!lastError) {
      break
    }
    if (!isSchemaCompatibilityError(lastError.message || '')) {
      break
    }
  }

  throw new Error(translateError(lastError?.message || 'Nao foi possivel criar a barbearia.'))
}

async function updateAvatarInFallbackRelations(shopId: string, primaryRelation: InsertRelation, avatarPath: string) {
  const orderedRelations: InsertRelation[] =
    primaryRelation === 'barbershops' ? ['barbershops', 'shops'] : ['shops', 'barbershops']

  for (const relation of orderedRelations) {
    const { error } = await supabase
      .from(relation)
      .update({ avatar_url: avatarPath })
      .eq('id', shopId)
    if (!error) return
    if (!isSchemaCompatibilityError(error.message || '')) {
      throw error
    }
  }
}

async function fetchReadBackShop(shopId: string, primaryRelation: InsertRelation) {
  const orderedRelations: InsertRelation[] =
    primaryRelation === 'barbershops' ? ['barbershops', 'shops'] : ['shops', 'barbershops']

  for (const relation of orderedRelations) {
    const { data } = await supabase
      .from(relation)
      .select('cep, address_number')
      .eq('id', shopId)
      .maybeSingle()
    if (data) {
      return data as Record<string, unknown>
    }
  }

  return null
}

function buildInitialBusinessHours(shopId: string, data: WizardData) {
  return [
    { shop_id: shopId, weekday: 1, closed: !data.schedule.weekdaysOpen, start_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysStart : null, end_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysEnd : null },
    { shop_id: shopId, weekday: 2, closed: !data.schedule.weekdaysOpen, start_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysStart : null, end_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysEnd : null },
    { shop_id: shopId, weekday: 3, closed: !data.schedule.weekdaysOpen, start_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysStart : null, end_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysEnd : null },
    { shop_id: shopId, weekday: 4, closed: !data.schedule.weekdaysOpen, start_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysStart : null, end_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysEnd : null },
    { shop_id: shopId, weekday: 5, closed: !data.schedule.weekdaysOpen, start_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysStart : null, end_time: data.schedule.weekdaysOpen ? data.schedule.weekdaysEnd : null },
    { shop_id: shopId, weekday: 6, closed: !data.schedule.saturdayOpen, start_time: data.schedule.saturdayOpen ? data.schedule.saturdayStart : null, end_time: data.schedule.saturdayOpen ? data.schedule.saturdayEnd : null },
    { shop_id: shopId, weekday: 0, closed: !data.schedule.sundayOpen, start_time: data.schedule.sundayOpen ? data.schedule.sundayStart : null, end_time: data.schedule.sundayOpen ? data.schedule.sundayEnd : null },
  ]
}

async function resolveAuthenticatedUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error('Sessao invalida. Entre novamente para continuar.')
  }
  return data.user
}

export function BarbershopSignupWizard() {
  const navigate = useNavigate()
  const { user, refreshUserData } = useAuth()
  const {
    state,
    pendingDraft,
    draftReady,
    setField,
    setScheduleField,
    nextStep,
    prevStep,
    setErrors,
    clearDraftStorage,
    resumeDraft,
    discardDraft,
    resetWizard,
    jumpToFirstInvalidStep,
  } = useWizardState()

  const [submitLoading, setSubmitLoading] = useState(false)
  const [accountLoading, setAccountLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitWarning, setSubmitWarning] = useState('')
  const [finishSuccess, setFinishSuccess] = useState(false)
  const [navigatingAfterSuccess, setNavigatingAfterSuccess] = useState(false)
  const [forceAccountForm, setForceAccountForm] = useState(false)

  useEffect(() => {
    return () => {
      if (state.data.logoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.data.logoPreviewUrl)
      }
    }
  }, [state.data.logoPreviewUrl])

  const currentStepInfo = STEP_COPY[state.step]
  const progress = (state.step / TOTAL_WIZARD_STEPS) * 100
  const accountAuthenticated = Boolean(user) && !forceAccountForm
  const skipAccountValidation = accountAuthenticated || state.step > 1
  const currentStepValidation = useMemo(
    () => validateStep(state.step, state.data, { skipAccountValidation: accountAuthenticated }),
    [state.step, state.data, accountAuthenticated]
  )
  const finalValidation = useMemo(
    () => validateAllSteps(state.data, { skipAccountValidation }),
    [state.data, skipAccountValidation]
  )
  const canAdvance = state.step === 6 ? finalValidation.ok : currentStepValidation.ok
  const loadingAction = submitLoading || accountLoading

  async function handleUseDifferentAccount() {
    setSubmitError('')
    setSubmitWarning('')
    setAccountLoading(true)
    setForceAccountForm(true)
    setField('accountEmail', '')
    setField('accountPassword', '')
    setField('accountConfirmPassword', '')
    setErrors({})

    const { error } = await supabase.auth.signOut()
    if (error) {
      setForceAccountForm(false)
      setSubmitError(translateError(error.message || 'Nao foi possivel trocar a conta agora.'))
    }

    setAccountLoading(false)
  }

  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    const rawValue = event.target.value
    const currentCaret = event.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, currentCaret)
    const formattedValue = formatPhone(rawValue)
    const nextCaret = caretIndexFromDigitCount(formattedValue, digitsBeforeCaret)
    setField('phone', formattedValue)

    requestAnimationFrame(() => {
      event.target.setSelectionRange(nextCaret, nextCaret)
    })
  }

  function handleLogoPick(file: File | null) {
    const nextErrors = { ...state.errors }
    delete nextErrors.logoFile

    if (!file) {
      if (state.data.logoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.data.logoPreviewUrl)
      }
      setField('logoFile', null)
      setField('logoPreviewUrl', null)
      setErrors(nextErrors)
      return
    }

    const allowedTypes = new Set(['image/png', 'image/jpeg'])
    if (!allowedTypes.has(file.type)) {
      setErrors({ ...nextErrors, logoFile: 'Formato invalido. Envie PNG ou JPG.' })
      return
    }

    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      setErrors({ ...nextErrors, logoFile: 'Arquivo muito grande. Limite de 2MB.' })
      return
    }

    if (state.data.logoPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(state.data.logoPreviewUrl)
    }
    const previewUrl = URL.createObjectURL(file)
    setField('logoFile', file)
    setField('logoPreviewUrl', previewUrl)
    setErrors(nextErrors)
  }

  async function handleAccountStepContinue() {
    const validation = validateStep(1, state.data, { skipAccountValidation: accountAuthenticated })
    setErrors(validation.errors)
    if (!validation.ok) return

    if (accountAuthenticated) {
      nextStep()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const normalizedEmail = state.data.accountEmail.trim().toLowerCase()
    const password = state.data.accountPassword

    setSubmitError('')
    setSubmitWarning('')
    setAccountLoading(true)

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      })

      if (signUpError) {
        const shouldTrySignIn = signUpError.status === 429 || isAlreadyRegisteredError(signUpError.message || '')
        if (!shouldTrySignIn) {
          setSubmitError(translateError(signUpError.message))
          return
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (signInError) {
          setSubmitError(translateError(signInError.message || signUpError.message))
          return
        }
      } else if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        })

        if (signInError) {
          setSubmitError('Conta criada, mas o login automatico falhou. Verifique seu email e entre para continuar.')
          return
        }
      }

      setField('accountEmail', normalizedEmail)
      setField('accountPassword', '')
      setField('accountConfirmPassword', '')
      setForceAccountForm(false)
      nextStep()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nao foi possivel validar sua conta neste momento.'
      setSubmitError(translateError(message))
    } finally {
      setAccountLoading(false)
    }
  }

  async function handleContinue() {
    if (state.step === 6) {
      await handleFinalize()
      return
    }

    if (state.step === 1) {
      await handleAccountStepContinue()
      return
    }

    const validation = validateStep(state.step, state.data)
    setErrors(validation.errors)
    if (!validation.ok) return
    nextStep()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    if (state.step === 1) return
    prevStep()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleFinalize() {
    const validation = validateAllSteps(state.data, { skipAccountValidation })
    setErrors(validation.errors)
    if (!validation.ok) {
      jumpToFirstInvalidStep(validation.errors)
      return
    }

    setSubmitError('')
    setSubmitWarning('')
    setSubmitLoading(true)

    try {
      const authenticatedUser = user ?? await resolveAuthenticatedUser()
      const normalizedShopName = state.data.shopName.trim()
      const normalizedOwnerName = state.data.ownerName.trim()
      const normalizedPhone = normalizePhone(state.data.phone)
      const normalizedCep = normalizeCep(state.data.cep)
      const normalizedStreet = state.data.street.trim()
      const normalizedNumber = state.data.number.trim()
      const normalizedNeighborhood = state.data.neighborhood.trim()
      const normalizedCity = state.data.city.trim()
      const normalizedState = state.data.state.trim().toUpperCase()
      const normalizedComplement = state.data.complement.trim()
      const normalizedTimezone = state.data.timezone.trim() || 'America/Fortaleza'
      const parsedProfessionalsCount = Number.parseInt(state.data.professionalsCount, 10)
      const parsedSlotInterval = Number.parseInt(state.data.slotIntervalMinutes, 10)
      const parsedBuffer = Number.parseInt(state.data.bufferMinutes, 10)
      const slug = `${generateSlug(normalizedShopName)}-${Date.now().toString(36)}`
      const addressLine = buildAddressLine({
        address_street: normalizedStreet,
        address_number: normalizedNumber,
        neighborhood: normalizedNeighborhood,
      })

      const fullPayload = sanitizePayload({
        name: normalizedShopName,
        slug,
        phone: normalizedPhone || null,
        cep: normalizedCep,
        address_street: normalizedStreet || null,
        address_number: normalizedNumber || null,
        neighborhood: normalizedNeighborhood || null,
        city: normalizedCity || null,
        state: normalizedState || null,
        complement: normalizedComplement || null,
        address: addressLine || null,
        latitude: state.data.latitude,
        longitude: state.data.longitude,
        timezone: normalizedTimezone,
        slot_interval_minutes: parsedSlotInterval,
        buffer_minutes: parsedBuffer,
      })

      const extendedPayload = sanitizePayload({
        ...fullPayload,
        shop_type: state.data.businessType,
        owner_name: normalizedOwnerName || null,
        professionals_count: Number.isFinite(parsedProfessionalsCount) ? parsedProfessionalsCount : null,
      })

      const legacyPayload = sanitizePayload({
        name: normalizedShopName,
        slug,
        phone: normalizedPhone || null,
        address: addressLine || null,
        neighborhood: normalizedNeighborhood || null,
        city: normalizedCity || null,
        state: normalizedState || null,
        timezone: normalizedTimezone,
      })

      const attempts: InsertAttempt[] = [
        { relation: 'barbershops', mode: 'extended', payload: extendedPayload },
        { relation: 'barbershops', mode: 'full', payload: fullPayload },
        { relation: 'barbershops', mode: 'legacy', payload: legacyPayload },
        { relation: 'shops', mode: 'extended', payload: extendedPayload },
        { relation: 'shops', mode: 'full', payload: fullPayload },
        { relation: 'shops', mode: 'legacy', payload: legacyPayload },
      ]

      const insertResult = await insertShopWithFallback(attempts)
      const shopId = String(insertResult.row.id || '')
      if (!shopId) {
        throw new Error('Nao foi possivel obter o ID da barbearia criada.')
      }

      const { error: memberError } = await supabase
        .from('shop_members')
        .insert({ shop_id: shopId, user_id: authenticatedUser.id, role: 'admin' })
      if (memberError) {
        throw new Error(translateError(memberError.message || 'Falha ao vincular usuario como admin.'))
      }

      const hoursPayload = buildInitialBusinessHours(shopId, state.data)
      const { error: businessHoursError } = await supabase
        .from('business_hours')
        .insert(hoursPayload)
      if (businessHoursError) {
        setSubmitWarning('Cadastro concluido, mas nao foi possivel salvar horario inicial.')
      }

      if (state.data.logoFile) {
        try {
          const avatarPath = await uploadShopAvatar({
            file: state.data.logoFile,
            userId: authenticatedUser.id,
          })
          await updateAvatarInFallbackRelations(shopId, insertResult.relation, avatarPath)
        } catch (avatarError) {
          const avatarMessage =
            avatarError instanceof Error ? avatarError.message : 'Falha ao enviar logo da barbearia.'
          setSubmitWarning(avatarMessage)
        }
      }

      const readBack = await fetchReadBackShop(shopId, insertResult.relation)
      if (readBack) {
        const readCep = normalizeCep(String(readBack.cep || ''))
        const readNumber = String(readBack.address_number || '').trim()
        if (normalizedCep && readCep !== normalizedCep) {
          setSubmitWarning('Cadastro salvo, mas o CEP retornou diferente no banco. Confira em Configuracoes.')
        }
        if (normalizedNumber && readNumber !== normalizedNumber) {
          setSubmitWarning('Cadastro salvo, mas o numero retornou diferente no banco. Confira em Configuracoes.')
        }
      }

      await supabase.auth.updateUser({
        data: {
          name: normalizedOwnerName || null,
          phone: normalizedPhone || null,
        },
      })

      clearDraftStorage()
      resetWizard()
      setFinishSuccess(true)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nao foi possivel finalizar o cadastro da barbearia.'
      setSubmitError(translateError(message))
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleGoToDashboard() {
    setNavigatingAfterSuccess(true)
    try {
      await refreshUserData()
    } finally {
      navigate('/app/dashboard', { replace: true })
    }
  }

  function renderStep() {
    if (state.step === 1) {
      return (
        <Step1Account
          data={state.data}
          errors={state.errors}
          isAuthenticated={accountAuthenticated}
          currentEmail={user?.email || state.data.accountEmail}
          accountLoading={accountLoading}
          onUseDifferentAccount={() => void handleUseDifferentAccount()}
          onFieldChange={setField}
        />
      )
    }

    if (state.step === 2) {
      return (
        <Step1BusinessType
          value={state.data.businessType}
          error={state.errors.businessType}
          onSelect={(value) => setField('businessType', value)}
        />
      )
    }

    if (state.step === 3) {
      return (
        <Step2Location
          data={state.data}
          errors={state.errors}
          onFieldChange={setField}
        />
      )
    }

    if (state.step === 4) {
      return (
        <Step3Owner
          data={state.data}
          errors={state.errors}
          onFieldChange={setField}
          onPhoneChange={handlePhoneChange}
          onLogoPick={handleLogoPick}
        />
      )
    }

    if (state.step === 5) {
      return (
        <Step4Operation
          data={state.data}
          errors={state.errors}
          onFieldChange={setField}
          onScheduleChange={setScheduleField}
        />
      )
    }

    if (state.step === 6) {
      return <Step5Review data={state.data} />
    }

    return null
  }

  if (!draftReady) {
    return (
      <div className="signup-wizard-bg flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="signup-wizard-card signup-wizard-scope w-full max-w-[720px] rounded-[20px] p-8 text-center">
          <p className="text-sm text-[#cbd5e1]">Preparando cadastro...</p>
        </div>
      </div>
    )
  }

  if (pendingDraft) {
    return (
      <div className="signup-wizard-bg flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="signup-wizard-card signup-wizard-scope w-full max-w-[720px] rounded-[20px] p-6 sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(59,130,246,0.45)] bg-[rgba(37,99,235,0.2)] text-[#bfdbfe]">
            <Scissors size={20} />
          </div>
          <h1 className="text-center text-2xl font-bold text-[#f8fafc]">Continuar cadastro da barbearia</h1>
          <p className="mt-2 text-center text-sm text-[#94a3b8]">
            Encontramos um rascunho salvo em {new Date(pendingDraft.savedAt).toLocaleString()}.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-xl border border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.7)] px-4 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:bg-[rgba(30,41,59,0.88)]"
            >
              Comecar do zero
            </button>
            <button
              type="button"
              onClick={resumeDraft}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              Continuar de onde parou
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (finishSuccess) {
    return (
      <div className="signup-wizard-bg flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="signup-wizard-card signup-wizard-scope w-full max-w-[720px] rounded-[20px] p-6 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(74,222,128,0.4)] bg-[rgba(22,101,52,0.35)] text-[#bbf7d0]">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-bold text-[#f8fafc]">Cadastro concluido com sucesso</h1>
          <p className="mt-2 text-sm text-[#94a3b8]">
            Sua barbearia foi criada. Agora voce pode gerenciar agenda, servicos e equipe.
          </p>

          {submitWarning && (
            <p className="mt-4 rounded-xl border border-[rgba(250,204,21,0.35)] bg-[rgba(113,63,18,0.35)] px-3 py-2 text-sm text-[#fde68a]">
              {submitWarning}
            </p>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={() => void handleGoToDashboard()}
              disabled={navigatingAfterSuccess}
              className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {navigatingAfterSuccess ? 'Redirecionando...' : 'Ir para o dashboard'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-wizard-bg min-h-[100dvh] px-4 pb-24 pt-5 sm:px-6 sm:py-10">
      <main className="signup-wizard-card signup-wizard-scope mx-auto w-full max-w-[720px] rounded-[20px] border border-[rgba(255,255,255,0.06)] shadow-[0_28px_68px_rgba(2,6,23,0.52)]">
        <header className="signup-wizard-header sticky top-0 z-20 rounded-t-[20px] border-b border-[rgba(148,163,184,0.2)] bg-[rgba(15,23,42,0.95)] px-4 pb-4 pt-4 backdrop-blur md:px-8">
          <div className="wizard-progress-track">
            <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="wizard-progress-dots mt-3">
            {Array.from({ length: TOTAL_WIZARD_STEPS }, (_, index) => {
              const dotStep = (index + 1) as WizardStep
              const active = dotStep === state.step
              const done = dotStep < state.step
              return (
                <span
                  key={`wizard-step-dot-${dotStep}`}
                  className={`wizard-progress-dot ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                />
              )
            })}
          </div>

          <div className="mt-4 text-center">
            <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(59,130,246,0.42)] bg-[rgba(37,99,235,0.2)] text-[#bfdbfe]">
              <Scissors size={16} />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#94a3b8]">
              Passo {state.step} de {TOTAL_WIZARD_STEPS}
            </p>
            <h1 className="mt-2 text-[26px] font-bold leading-tight text-[#f8fafc] sm:text-[30px]">
              {currentStepInfo.title}
            </h1>
            <p className="mx-auto mt-2 max-w-[56ch] text-sm text-[#94a3b8]">{currentStepInfo.subtitle}</p>
          </div>
        </header>

        <section className="space-y-4 px-4 py-5 pb-28 md:px-8 md:py-6 md:pb-6">
          {submitError && (
            <div className="rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.32)] px-3 py-2 text-sm text-[#fecaca]">
              {submitError}
            </div>
          )}

          {submitWarning && !submitError && (
            <div className="rounded-xl border border-[rgba(250,204,21,0.35)] bg-[rgba(113,63,18,0.35)] px-3 py-2 text-sm text-[#fde68a]">
              {submitWarning}
            </div>
          )}

          {renderStep()}

          <div className="hidden items-center justify-end gap-2 pt-1 sm:flex">
            <button
              type="button"
              onClick={handleBack}
              disabled={state.step === 1 || loadingAction}
              className="rounded-xl border border-[rgba(148,163,184,0.3)] bg-[rgba(15,23,42,0.7)] px-4 py-2.5 text-sm font-semibold text-[#cbd5e1] transition hover:bg-[rgba(30,41,59,0.88)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canAdvance || loadingAction}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submitLoading
                ? 'Salvando...'
                : accountLoading
                  ? 'Criando conta...'
                  : state.step === 6
                    ? 'Finalizar cadastro'
                    : 'Continuar'}
            </button>
          </div>
        </section>
      </main>

      <div className="wizard-mobile-actionbar sm:hidden">
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={state.step === 1 || loadingAction}
            className="min-h-[52px] rounded-[14px] border border-[rgba(148,163,184,0.32)] bg-[rgba(15,23,42,0.92)] px-4 text-sm font-semibold text-[#cbd5e1] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canAdvance || loadingAction}
            className="min-h-[52px] flex-1 rounded-[14px] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitLoading
              ? 'Salvando...'
              : accountLoading
                ? 'Criando conta...'
                : state.step === 6
                  ? 'Finalizar cadastro'
                  : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
