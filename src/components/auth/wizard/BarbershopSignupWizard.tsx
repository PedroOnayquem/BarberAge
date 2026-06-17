import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Building2, CheckCircle2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { translateError } from '../../../lib/errorMessages'
import { buildAddressLine, buildReadableAddress, normalizeCep } from '../../../lib/location'
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

interface AuthAccountStatus {
  accountExists: boolean
  emailConfirmed: boolean
}

type InsertMode = 'full' | 'legacy'
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
    subtitle: 'Use email e senha para iniciar o cadastro da sua empresa.',
  },
  2: {
    title: 'Quais categorias sua empresa atende?',
    subtitle: 'Selecione uma ou mais categorias para aparecer nos filtros do marketplace.',
  },
  3: {
    title: 'Onde fica sua empresa?',
    subtitle: 'Digite o CEP e complete as informacoes.',
  },
  4: {
    title: 'Dados do responsavel',
    subtitle: 'Esses dados serao usados para contato e administracao.',
  },
  5: {
    title: 'Como sua empresa funciona?',
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

function shouldTryExistingAccountFallback(status?: number, code?: string, message?: string) {
  if (status === 429) return true
  if ((code || '').toLowerCase() === 'user_already_exists') return true
  const normalized = (message || '').toLowerCase()
  return (
    isAlreadyRegisteredError(message || '') ||
    (status === 422 && (
      normalized.includes('already') ||
      normalized.includes('registered') ||
      normalized.includes('exists')
    ))
  )
}

function isEmailNotConfirmedError(code?: string, message?: string) {
  if ((code || '').toLowerCase() === 'email_not_confirmed') return true
  return (message || '').toLowerCase().includes('email not confirmed')
}

function isInvalidCredentialsError(code?: string, message?: string) {
  const normalizedCode = (code || '').toLowerCase()
  const normalizedMessage = (message || '').toLowerCase()
  return (
    normalizedCode === 'invalid_credentials' ||
    normalizedCode === 'invalid_login_credentials' ||
    normalizedMessage.includes('invalid login credentials')
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

  throw new Error(translateError(lastError?.message || 'Nao foi possivel criar a empresa.'))
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

async function loadSelectedCategories(categorySlugs: string[]) {
  const normalizedSlugs = Array.from(new Set(categorySlugs.map((slug) => slug.trim()).filter(Boolean)))
  if (normalizedSlugs.length === 0) {
    throw new Error('Selecione pelo menos uma categoria.')
  }

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', normalizedSlugs)

  if (categoriesError) {
    if (isSchemaCompatibilityError(categoriesError.message || '')) {
      throw new Error('As categorias ainda nao existem no banco. Aplique a migration de marketplace antes de finalizar o cadastro.')
    }
    throw new Error(translateError(categoriesError.message || 'Nao foi possivel carregar as categorias.'))
  }

  const categoryRows = categories || []
  const foundSlugs = new Set(categoryRows.map((category) => category.slug))
  const missingSlugs = normalizedSlugs.filter((slug) => !foundSlugs.has(slug))
  if (missingSlugs.length > 0) {
    throw new Error('Uma ou mais categorias selecionadas nao existem no banco de dados.')
  }

  return categoryRows
}

async function assignShopCategories(shopId: string, categoryRows: Array<{ id: string; slug: string }>) {
  const { error: deleteError } = await supabase
    .from('shop_categories')
    .delete()
    .eq('shop_id', shopId)

  if (deleteError) {
    throw new Error(translateError(deleteError.message || 'Nao foi possivel atualizar as categorias.'))
  }

  const { error: insertError } = await supabase
    .from('shop_categories')
    .insert(categoryRows.map((category) => ({ shop_id: shopId, category_id: category.id })))

  if (insertError) {
    throw new Error(translateError(insertError.message || 'Nao foi possivel salvar as categorias.'))
  }
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

async function fetchAuthAccountStatus(email: string): Promise<AuthAccountStatus | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return {
      accountExists: false,
      emailConfirmed: false,
    }
  }

  const { data, error } = await (supabase as typeof supabase & {
    rpc: (fn: string, args: Record<string, unknown>) => {
      single: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>
    }
  })
    .rpc('get_auth_account_status', { p_email: normalizedEmail })
    .single()

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[create-shop] get_auth_account_status failed', {
        code: error.code,
        message: error.message,
      })
    }
    return null
  }

  const statusRow = (data || {}) as Partial<{ account_exists: boolean; email_confirmed: boolean }>
  return {
    accountExists: Boolean(statusRow.account_exists),
    emailConfirmed: Boolean(statusRow.email_confirmed),
  }
}

export function BarbershopSignupWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading, refreshUserData } = useAuth()
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
  const [newIntentSessionChecked, setNewIntentSessionChecked] = useState(() => searchParams.get('intent') !== 'new')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const forceNewAccountIntent = searchParams.get('intent') === 'new'

  function normalizeEmail(value: string | null | undefined) {
    return (value || '').trim().toLowerCase()
  }

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  useEffect(() => {
    return () => {
      if (state.data.logoPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(state.data.logoPreviewUrl)
      }
    }
  }, [state.data.logoPreviewUrl])

  const currentStepInfo = STEP_COPY[state.step]
  const progress = (state.step / TOTAL_WIZARD_STEPS) * 100
  const accountAuthenticated = Boolean(user) && !forceAccountForm && !forceNewAccountIntent
  const pendingDraftEmail = normalizeEmail(pendingDraft?.data.accountEmail)
  const activeEmail = normalizeEmail(user?.email)
  const enteredEmail = normalizeEmail(state.data.accountEmail)
  const pendingDraftSavedAtLabel = pendingDraft?.savedAt
    ? new Date(pendingDraft.savedAt).toLocaleString('pt-BR')
    : ''
  const hasPendingDraftForAuthenticatedUser = Boolean(
    !forceNewAccountIntent &&
    pendingDraft &&
    pendingDraftEmail &&
    activeEmail === pendingDraftEmail
  )
  const hasPendingDraftForEnteredEmail = Boolean(
    pendingDraft &&
    pendingDraftEmail &&
    !accountAuthenticated &&
    enteredEmail &&
    enteredEmail === pendingDraftEmail
  )
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

  useEffect(() => {
    if (!forceNewAccountIntent || newIntentSessionChecked) return
    if (authLoading || !draftReady) return
    if (state.step > 1) {
      setNewIntentSessionChecked(true)
      return
    }
    if (!user) {
      setNewIntentSessionChecked(true)
      return
    }

    let cancelled = false

    void (async () => {
      setAccountLoading(true)
      setForceAccountForm(true)
      setSubmitError('')
      const { error } = await supabase.auth.signOut()
      if (cancelled) return
      if (error) {
        setSubmitError(translateError(error.message || 'Nao foi possivel limpar a sessao anterior.'))
      }
      setAccountLoading(false)
      setNewIntentSessionChecked(true)
    })()

    return () => {
      cancelled = true
    }
  }, [authLoading, draftReady, forceNewAccountIntent, newIntentSessionChecked, state.step, user])

  useEffect(() => {
    if (!pendingDraft) return
    if (!pendingDraftEmail) {
      discardDraft()
      return
    }
    if (accountAuthenticated && activeEmail && activeEmail !== pendingDraftEmail) {
      discardDraft()
    }
  }, [accountAuthenticated, activeEmail, discardDraft, pendingDraft, pendingDraftEmail])

  function handleAccountEmailChange(value: string) {
    const normalizedValue = normalizeEmail(value)
    if (verificationEmail && normalizedValue !== verificationEmail) {
      setVerificationEmail('')
      setVerificationMessage('')
    }
    if (
      pendingDraft &&
      pendingDraftEmail &&
      !accountAuthenticated &&
      normalizedValue &&
      isValidEmail(normalizedValue) &&
      normalizedValue !== pendingDraftEmail
    ) {
      discardDraft()
    }

    setField('accountEmail', value)
  }

  function markVerificationRequired(email: string, message: string) {
    setVerificationEmail(email)
    setVerificationMessage(message)
    setSubmitError('')
    setSubmitWarning('')
  }

  function resetVerificationState(clearFields = false) {
    setVerificationEmail('')
    setVerificationMessage('')
    if (!clearFields) return
    setField('accountEmail', '')
    setField('accountPassword', '')
    setField('accountConfirmPassword', '')
    setErrors({})
  }

  async function loginAndAdvance(email: string, password: string, options?: { existingAccount?: boolean }) {
    const { data: loginData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      if (import.meta.env.DEV) {
        console.error('[create-shop] signIn fallback failed', {
          status: signInError.status,
          code: signInError.code,
          message: signInError.message,
        })
      }

      if (isEmailNotConfirmedError(signInError.code, signInError.message)) {
        markVerificationRequired(
          email,
          `A conta para ${email} ja existe, mas o email ainda nao foi confirmado. Confirme o email e depois clique em "Ja confirmei, entrar e continuar".`
        )
        return false
      }

      if (options?.existingAccount && isInvalidCredentialsError(signInError.code, signInError.message)) {
        setSubmitError('Este email ja esta cadastrado. Use a senha original da conta ou recupere o acesso para continuar.')
        return false
      }

      setSubmitError(translateError(signInError.message || 'Nao foi possivel entrar com esta conta agora.'))
      return false
    }

    if (!loginData.user) {
      setSubmitError('Nao foi possivel validar sua conta neste momento.')
      return false
    }

    setVerificationEmail('')
    setVerificationMessage('')
    setField('accountEmail', email)
    setField('accountPassword', '')
    setField('accountConfirmPassword', '')
    setForceAccountForm(false)
    nextStep()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  async function handleUseDifferentAccount() {
    setSubmitError('')
    setSubmitWarning('')
    setVerificationEmail('')
    setVerificationMessage('')
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

  async function handleRetryAccountAccess() {
    const normalizedEmail = state.data.accountEmail.trim().toLowerCase()
    const password = state.data.accountPassword

    if (!normalizedEmail) {
      setErrors({ accountEmail: 'Informe o email.' })
      return
    }

    if (!password) {
      setErrors({ accountPassword: 'Informe a senha.' })
      return
    }

    setSubmitError('')
    setSubmitWarning('')
    setAccountLoading(true)

    try {
      const accountStatus = await fetchAuthAccountStatus(normalizedEmail)
      if (accountStatus && !accountStatus.accountExists) {
        resetVerificationState()
        setSubmitError('Nao encontramos uma conta criada para este email. Tente novamente o cadastro.')
        return
      }

      if (accountStatus && !accountStatus.emailConfirmed) {
        markVerificationRequired(
          normalizedEmail,
          `A conta para ${normalizedEmail} ainda nao foi confirmada. Confirme o email e depois clique novamente em "Ja confirmei, entrar e continuar".`
        )
        return
      }

      await loginAndAdvance(normalizedEmail, password, { existingAccount: true })
    } finally {
      setAccountLoading(false)
    }
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
      if (verificationEmail && verificationEmail === normalizedEmail) {
        await handleRetryAccountAccess()
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const activeEmail = sessionData.session?.user?.email?.trim().toLowerCase() || null
      if (activeEmail && activeEmail !== normalizedEmail) {
        await supabase.auth.signOut()
      }

      const accountStatus = await fetchAuthAccountStatus(normalizedEmail)
      if (accountStatus?.accountExists) {
        if (!accountStatus.emailConfirmed) {
          markVerificationRequired(
            normalizedEmail,
            `A conta para ${normalizedEmail} ja existe, mas o email ainda nao foi confirmado. Confirme o email e depois clique em "Ja confirmei, entrar e continuar".`
          )
          return
        }

        const didAdvance = await loginAndAdvance(normalizedEmail, password, { existingAccount: true })
        if (!didAdvance) return
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      })

      if (signUpError) {
        if (import.meta.env.DEV) {
          console.error('[create-shop] signUp failed', {
            status: signUpError.status,
            code: signUpError.code,
            message: signUpError.message,
          })
        }

        const shouldTrySignIn = shouldTryExistingAccountFallback(signUpError.status, signUpError.code, signUpError.message)
        if (!shouldTrySignIn) {
          setSubmitError(translateError(signUpError.message))
          return
        }

        const refreshedStatus = await fetchAuthAccountStatus(normalizedEmail)
        if (refreshedStatus?.accountExists && !refreshedStatus.emailConfirmed) {
          markVerificationRequired(
            normalizedEmail,
            `A conta para ${normalizedEmail} ja existe, mas o email ainda nao foi confirmado. Confirme o email e depois clique em "Ja confirmei, entrar e continuar".`
          )
          return
        }

        const didAdvance = await loginAndAdvance(normalizedEmail, password, { existingAccount: true })
        if (!didAdvance) return
      } else if (!signUpData.session) {
        markVerificationRequired(
          normalizedEmail,
          `A conta para ${normalizedEmail} foi criada. Confirme o email enviado e depois clique em "Ja confirmei, entrar e continuar".`
        )
        return
      }

      setField('accountEmail', normalizedEmail)
      setField('accountPassword', '')
      setField('accountConfirmPassword', '')
      setVerificationEmail('')
      setVerificationMessage('')
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

  function handleCategoryToggle(categorySlug: WizardData['categorySlugs'][number]) {
    const selected = state.data.categorySlugs.includes(categorySlug)
    const nextCategories = selected
      ? state.data.categorySlugs.filter((slug) => slug !== categorySlug)
      : [...state.data.categorySlugs, categorySlug]
    setField('categorySlugs', nextCategories)
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
      const normalizedCategorySlugs = Array.from(new Set(state.data.categorySlugs))
      const parsedSlotInterval = Number.parseInt(state.data.slotIntervalMinutes, 10)
      const parsedBuffer = Number.parseInt(state.data.bufferMinutes, 10)
      const slug = `${generateSlug(normalizedShopName)}-${Date.now().toString(36)}`
      const hasConfirmedCoordinates =
        state.data.mapConfirmed &&
        typeof state.data.latitude === 'number' &&
        typeof state.data.longitude === 'number'
      const manualFormattedAddress = buildReadableAddress({
        cep: normalizedCep,
        address_street: normalizedStreet,
        address_number: normalizedNumber,
        neighborhood: normalizedNeighborhood,
        city: normalizedCity,
        state: normalizedState,
        complement: normalizedComplement,
      })
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
        formatted_address: hasConfirmedCoordinates ? manualFormattedAddress : null,
        geocode_precision: hasConfirmedCoordinates ? 'rooftop' : null,
        geocode_provider: hasConfirmedCoordinates ? 'manual_map' : null,
        geocoded_at: hasConfirmedCoordinates ? new Date().toISOString() : null,
        timezone: normalizedTimezone,
        slot_interval_minutes: parsedSlotInterval,
        buffer_minutes: parsedBuffer,
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
      const selectedCategoryRows = await loadSelectedCategories(normalizedCategorySlugs)

      const attempts: InsertAttempt[] = [
        { relation: 'shops', mode: 'full', payload: fullPayload },
        { relation: 'shops', mode: 'legacy', payload: legacyPayload },
        { relation: 'barbershops', mode: 'full', payload: fullPayload },
        { relation: 'barbershops', mode: 'legacy', payload: legacyPayload },
      ]

      const insertResult = await insertShopWithFallback(attempts)
      const shopId = String(insertResult.row.id || '')
      if (!shopId) {
        throw new Error('Nao foi possivel obter o ID da empresa criada.')
      }

      const { error: memberError } = await supabase
        .from('shop_members')
        .insert({ shop_id: shopId, user_id: authenticatedUser.id, role: 'admin' })
      if (memberError) {
        throw new Error(translateError(memberError.message || 'Falha ao vincular usuario como admin.'))
      }

      await assignShopCategories(shopId, selectedCategoryRows)

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
            avatarError instanceof Error ? avatarError.message : 'Falha ao enviar logo da empresa.'
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
        error instanceof Error ? error.message : 'Nao foi possivel finalizar o cadastro da empresa.'
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
          verificationEmail={verificationEmail || undefined}
          verificationMessage={verificationMessage || undefined}
          pendingDraftEmail={pendingDraftEmail || undefined}
          pendingDraftSavedAt={pendingDraftSavedAtLabel || undefined}
          showDraftActions={hasPendingDraftForAuthenticatedUser || hasPendingDraftForEnteredEmail}
          onUseDifferentAccount={() => void handleUseDifferentAccount()}
          onUseAnotherEmail={() => resetVerificationState(true)}
          onRetryAccountAccess={() => void handleRetryAccountAccess()}
          onResumeDraft={resumeDraft}
          onDiscardDraft={discardDraft}
          onAccountEmailChange={handleAccountEmailChange}
          onFieldChange={setField}
        />
      )
    }

    if (state.step === 2) {
      return (
        <Step1BusinessType
          value={state.data.categorySlugs}
          error={state.errors.categorySlugs}
          onToggle={handleCategoryToggle}
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
        <div className="signup-wizard-card signup-wizard-scope w-full max-w-[720px] rounded-[28px] border border-[var(--color-border)] p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-[var(--color-text-muted)]">Preparando cadastro...</p>
        </div>
      </div>
    )
  }

  if (forceNewAccountIntent && !newIntentSessionChecked) {
    return (
      <div className="signup-wizard-bg flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="signup-wizard-card signup-wizard-scope w-full max-w-[720px] rounded-[28px] border border-[var(--color-border)] p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-sm text-[var(--color-text-muted)]">Preparando cadastro...</p>
        </div>
      </div>
    )
  }

  if (finishSuccess) {
    return (
      <div className="signup-wizard-bg flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="signup-wizard-card signup-wizard-scope w-full max-w-[720px] rounded-[28px] border border-[var(--color-border)] p-6 text-center shadow-[var(--shadow-card)] sm:p-10">
          <div className="brand-gradient-bg mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_18px_42px_rgba(123,97,255,0.28)]">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Cadastro concluido com sucesso</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Sua empresa foi criada. Agora voce pode gerenciar agenda, servicos e equipe.
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
              className="brand-gradient-bg w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
      <main className="signup-wizard-card signup-wizard-scope mx-auto w-full max-w-[720px] rounded-[28px] border border-[var(--color-border)] shadow-[var(--shadow-card)]">
        <header className="signup-wizard-header sticky top-0 z-20 rounded-t-[28px] border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)]/95 px-4 pb-4 pt-4 backdrop-blur-xl md:px-8">
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
            <div className="brand-gradient-bg mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_rgba(123,97,255,0.25)]">
              <Building2 size={16} />
            </div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              Passo {state.step} de {TOTAL_WIZARD_STEPS}
            </p>
            <h1 className="mt-2 text-[26px] font-bold leading-tight text-[var(--color-text)] sm:text-[30px]">
              {currentStepInfo.title}
            </h1>
            <p className="mx-auto mt-2 max-w-[56ch] text-sm text-[var(--color-text-muted)]">{currentStepInfo.subtitle}</p>
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
              className="rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canAdvance || loadingAction}
              className="brand-gradient-bg rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
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
            className="min-h-[52px] rounded-2xl border border-[var(--color-border)] bg-white/[0.055] px-4 text-sm font-semibold text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canAdvance || loadingAction}
            className="brand-gradient-bg min-h-[52px] flex-1 rounded-2xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
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
