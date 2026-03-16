import { useEffect, useReducer, useState } from 'react'
import { normalizeCep } from '../../../lib/location'
import { normalizePhone } from '../../../lib/phone'

export const SHOP_SIGNUP_DRAFT_KEY = 'barberage:shop_signup_draft'
export const TOTAL_WIZARD_STEPS = 6

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export type BusinessType = 'traditional' | 'modern' | 'studio' | 'premium' | 'multi_unit' | null

export interface BusinessTypeOption {
  value: Exclude<BusinessType, null>
  title: string
  description: string
}

export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = [
  {
    value: 'traditional',
    title: 'Barbearia tradicional',
    description: 'Atendimento classico e agenda simples.',
  },
  {
    value: 'modern',
    title: 'Barbearia moderna',
    description: 'Visual atual com servicos diversos.',
  },
  {
    value: 'studio',
    title: 'Estudio masculino',
    description: 'Experiencia personalizada para publico masculino.',
  },
  {
    value: 'premium',
    title: 'Barbearia premium',
    description: 'Foco em servico de alto padrao.',
  },
  {
    value: 'multi_unit',
    title: 'Multiplas unidades',
    description: 'Gestao para rede com mais de uma loja.',
  },
]

export interface WizardSchedule {
  weekdaysOpen: boolean
  weekdaysStart: string
  weekdaysEnd: string
  saturdayOpen: boolean
  saturdayStart: string
  saturdayEnd: string
  sundayOpen: boolean
  sundayStart: string
  sundayEnd: string
}

export interface WizardData {
  accountEmail: string
  accountPassword: string
  accountConfirmPassword: string
  businessType: BusinessType
  cep: string
  state: string
  city: string
  neighborhood: string
  street: string
  number: string
  complement: string
  latitude: number | null
  longitude: number | null
  mapConfirmed: boolean
  ownerName: string
  phone: string
  shopName: string
  logoFile: File | null
  logoPreviewUrl: string | null
  professionalsCount: string
  slotIntervalMinutes: string
  bufferMinutes: string
  timezone: string
  schedule: WizardSchedule
}

export type WizardErrors = Record<string, string>

interface WizardState {
  step: WizardStep
  data: WizardData
  errors: WizardErrors
}

type Action =
  | { type: 'set_step'; step: WizardStep }
  | { type: 'next_step' }
  | { type: 'prev_step' }
  | { type: 'set_field'; field: keyof WizardData; value: WizardData[keyof WizardData] }
  | { type: 'set_schedule_field'; field: keyof WizardSchedule; value: WizardSchedule[keyof WizardSchedule] }
  | { type: 'set_errors'; errors: WizardErrors }
  | { type: 'hydrate'; draft: WizardDraftSnapshot }
  | { type: 'reset' }

type DraftData = Omit<WizardData, 'logoFile' | 'logoPreviewUrl' | 'accountPassword' | 'accountConfirmPassword'>

export interface WizardDraftSnapshot {
  step: WizardStep
  data: DraftData
  savedAt: string
}

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

export const TIMEZONE_OPTIONS = [
  { value: 'America/Fortaleza', label: 'GMT-3 Fortaleza' },
  { value: 'America/Sao_Paulo', label: 'GMT-3 Sao Paulo' },
  { value: 'America/Bahia', label: 'GMT-3 Salvador' },
  { value: 'America/Recife', label: 'GMT-3 Recife' },
  { value: 'America/Manaus', label: 'GMT-4 Manaus' },
  { value: 'America/Rio_Branco', label: 'GMT-5 Rio Branco' },
]

function createInitialData(): WizardData {
  return {
    accountEmail: '',
    accountPassword: '',
    accountConfirmPassword: '',
    businessType: null,
    cep: '',
    state: '',
    city: '',
    neighborhood: '',
    street: '',
    number: '',
    complement: '',
    latitude: null,
    longitude: null,
    mapConfirmed: false,
    ownerName: '',
    phone: '',
    shopName: '',
    logoFile: null,
    logoPreviewUrl: null,
    professionalsCount: '1',
    slotIntervalMinutes: '30',
    bufferMinutes: '0',
    timezone: 'America/Fortaleza',
    schedule: {
      weekdaysOpen: true,
      weekdaysStart: '09:00',
      weekdaysEnd: '19:00',
      saturdayOpen: true,
      saturdayStart: '09:00',
      saturdayEnd: '18:00',
      sundayOpen: false,
      sundayStart: '09:00',
      sundayEnd: '13:00',
    },
  }
}

function createInitialState(): WizardState {
  return {
    step: 1,
    data: createInitialData(),
    errors: {},
  }
}

function clampStep(step: number): WizardStep {
  if (step <= 1) return 1
  if (step >= TOTAL_WIZARD_STEPS) return 6
  return step as WizardStep
}

function reducer(state: WizardState, action: Action): WizardState {
  if (action.type === 'set_step') {
    return { ...state, step: action.step, errors: {} }
  }

  if (action.type === 'next_step') {
    return { ...state, step: clampStep(state.step + 1), errors: {} }
  }

  if (action.type === 'prev_step') {
    return { ...state, step: clampStep(state.step - 1), errors: {} }
  }

  if (action.type === 'set_field') {
    const nextErrors = { ...state.errors }
    delete nextErrors[action.field as string]
    return {
      ...state,
      data: {
        ...state.data,
        [action.field]: action.value,
      },
      errors: nextErrors,
    }
  }

  if (action.type === 'set_schedule_field') {
    const key = `schedule.${action.field as string}`
    const nextErrors = { ...state.errors }
    delete nextErrors[key]
    return {
      ...state,
      data: {
        ...state.data,
        schedule: {
          ...state.data.schedule,
          [action.field]: action.value,
        },
      },
      errors: nextErrors,
    }
  }

  if (action.type === 'set_errors') {
    return { ...state, errors: action.errors }
  }

  if (action.type === 'hydrate') {
    return {
      step: clampStep(action.draft.step),
      data: {
        ...createInitialData(),
        ...action.draft.data,
        accountPassword: '',
        accountConfirmPassword: '',
        logoFile: null,
        logoPreviewUrl: null,
      },
      errors: {},
    }
  }

  if (action.type === 'reset') {
    return createInitialState()
  }

  return state
}

function serializeDraft(state: WizardState): WizardDraftSnapshot {
  const draftData = { ...state.data } as Partial<WizardData>
  delete draftData.accountPassword
  delete draftData.accountConfirmPassword
  delete draftData.logoFile
  delete draftData.logoPreviewUrl
  draftData.accountEmail =
    typeof draftData.accountEmail === 'string' ? draftData.accountEmail.trim().toLowerCase() : ''

  return {
    step: state.step,
    data: draftData as DraftData,
    savedAt: new Date().toISOString(),
  }
}

function hasPersistableDraftContent(data: WizardData) {
  return Boolean(
    data.businessType ||
    normalizeCep(data.cep) ||
    data.state.trim() ||
    data.city.trim() ||
    data.neighborhood.trim() ||
    data.street.trim() ||
    data.number.trim() ||
    data.complement.trim() ||
    data.latitude !== null ||
    data.longitude !== null ||
    data.mapConfirmed ||
    data.ownerName.trim() ||
    normalizePhone(data.phone) ||
    data.shopName.trim() ||
    data.professionalsCount !== '1' ||
    data.slotIntervalMinutes !== '30' ||
    data.bufferMinutes !== '0' ||
    data.timezone !== 'America/Fortaleza' ||
    !data.schedule.weekdaysOpen ||
    data.schedule.weekdaysStart !== '09:00' ||
    data.schedule.weekdaysEnd !== '19:00' ||
    !data.schedule.saturdayOpen ||
    data.schedule.saturdayStart !== '09:00' ||
    data.schedule.saturdayEnd !== '18:00' ||
    data.schedule.sundayOpen ||
    data.schedule.sundayStart !== '09:00' ||
    data.schedule.sundayEnd !== '13:00'
  )
}

function shouldPersistDraft(state: Pick<WizardState, 'step' | 'data'>) {
  return state.step > 1 || hasPersistableDraftContent(state.data)
}

function readDraftFromStorage(): WizardDraftSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SHOP_SIGNUP_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WizardDraftSnapshot>
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.data || typeof parsed.data !== 'object') return null
    const parsedDraftData = parsed.data as Partial<WizardData>
    const parsedDraftEmail =
      typeof parsedDraftData.accountEmail === 'string' ? parsedDraftData.accountEmail.trim().toLowerCase() : ''
    const parsedStep = Number(parsed.step)
    if (!Number.isFinite(parsedStep)) return null
    const hydratedData: WizardData = {
      ...createInitialData(),
      ...parsedDraftData,
      accountEmail: parsedDraftEmail,
      accountPassword: '',
      accountConfirmPassword: '',
      logoFile: null,
      logoPreviewUrl: null,
    }
    if (!isValidEmail(hydratedData.accountEmail)) return null
    const normalizedStep = clampStep(parsedStep)
    if (!shouldPersistDraft({ step: normalizedStep, data: hydratedData })) return null
    return {
      step: normalizedStep,
      data: {
        ...(parsedDraftData as DraftData),
        accountEmail: hydratedData.accountEmail,
      },
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function hasDraftContent(data: WizardData) {
  return Boolean(
    data.accountEmail.trim() ||
    hasPersistableDraftContent(data)
  )
}

export interface StepValidation {
  ok: boolean
  errors: WizardErrors
}

interface ValidationOptions {
  skipAccountValidation?: boolean
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function hasValidTime(value: string) {
  return /^[0-2]\d:[0-5]\d$/.test(value)
}

function validateScheduleRange(
  open: boolean,
  start: string,
  end: string,
  keyPrefix: 'weekdays' | 'saturday' | 'sunday',
  errors: WizardErrors
) {
  if (!open) return
  if (!hasValidTime(start)) {
    errors[`schedule.${keyPrefix}Start`] = 'Hora inicial invalida.'
  }
  if (!hasValidTime(end)) {
    errors[`schedule.${keyPrefix}End`] = 'Hora final invalida.'
  }
  if (hasValidTime(start) && hasValidTime(end) && start >= end) {
    errors[`schedule.${keyPrefix}End`] = 'Hora final deve ser maior que a inicial.'
  }
}

export function validateStep(step: WizardStep, data: WizardData, options: ValidationOptions = {}): StepValidation {
  const errors: WizardErrors = {}

  if (step === 1) {
    if (!options.skipAccountValidation) {
      const email = data.accountEmail.trim().toLowerCase()
      if (!email) {
        errors.accountEmail = 'Informe o email.'
      } else if (!isValidEmail(email)) {
        errors.accountEmail = 'Informe um email valido.'
      }

      if (!data.accountPassword) {
        errors.accountPassword = 'Informe a senha.'
      } else if (data.accountPassword.length < 6) {
        errors.accountPassword = 'A senha deve ter pelo menos 6 caracteres.'
      }

      if (!data.accountConfirmPassword) {
        errors.accountConfirmPassword = 'Confirme a senha.'
      } else if (data.accountPassword !== data.accountConfirmPassword) {
        errors.accountConfirmPassword = 'As senhas nao coincidem.'
      }
    }
  }

  if (step === 2) {
    if (!data.businessType) {
      errors.businessType = 'Selecione o tipo da barbearia.'
    }
  }

  if (step === 3) {
    if (normalizeCep(data.cep).length !== 8) {
      errors.cep = 'Informe um CEP valido.'
    }
    if (!data.street.trim()) {
      errors.street = 'Informe o logradouro.'
    }
    if (!data.neighborhood.trim()) {
      errors.neighborhood = 'Informe o bairro.'
    }
    if (!data.city.trim()) {
      errors.city = 'Informe a cidade.'
    }
    if (data.state.trim().toUpperCase().length !== 2) {
      errors.state = 'UF deve ter 2 letras.'
    }
    if (!data.number.trim()) {
      errors.number = 'Informe o numero.'
    }
    if (data.latitude === null || data.longitude === null || !data.mapConfirmed) {
      errors.mapConfirmed = 'Confirme a localizacao no mapa.'
    }
  }

  if (step === 4) {
    if (!data.ownerName.trim()) {
      errors.ownerName = 'Informe o nome completo.'
    }
    const phoneDigits = normalizePhone(data.phone)
    if (phoneDigits.length < 10) {
      errors.phone = 'Informe um telefone valido com DDD.'
    }
    if (!data.shopName.trim()) {
      errors.shopName = 'Informe o nome da barbearia.'
    }
  }

  if (step === 5) {
    const professionals = Number.parseInt(data.professionalsCount, 10)
    const slotInterval = Number.parseInt(data.slotIntervalMinutes, 10)
    const buffer = Number.parseInt(data.bufferMinutes, 10)

    if (!Number.isFinite(professionals) || professionals < 0) {
      errors.professionalsCount = 'Informe um numero maior ou igual a 0.'
    }
    if (!Number.isFinite(slotInterval) || slotInterval <= 0) {
      errors.slotIntervalMinutes = 'Intervalo base deve ser maior que 0.'
    }
    if (!Number.isFinite(buffer) || buffer < 0) {
      errors.bufferMinutes = 'Buffer deve ser maior ou igual a 0.'
    }
    if (!data.timezone.trim()) {
      errors.timezone = 'Selecione o timezone.'
    }

    validateScheduleRange(
      data.schedule.weekdaysOpen,
      data.schedule.weekdaysStart,
      data.schedule.weekdaysEnd,
      'weekdays',
      errors
    )
    validateScheduleRange(
      data.schedule.saturdayOpen,
      data.schedule.saturdayStart,
      data.schedule.saturdayEnd,
      'saturday',
      errors
    )
    validateScheduleRange(
      data.schedule.sundayOpen,
      data.schedule.sundayStart,
      data.schedule.sundayEnd,
      'sunday',
      errors
    )
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  }
}

export function validateAllSteps(data: WizardData, options: ValidationOptions = {}): StepValidation {
  const collectedErrors: WizardErrors = {}
  const steps: WizardStep[] = [1, 2, 3, 4, 5]
  for (const step of steps) {
    const result = validateStep(step, data, options)
    Object.assign(collectedErrors, result.errors)
  }
  return {
    ok: Object.keys(collectedErrors).length === 0,
    errors: collectedErrors,
  }
}

function resolveFirstInvalidStep(errors: WizardErrors): WizardStep {
  const orderedFieldGroups: Array<{ step: WizardStep; fields: string[] }> = [
    {
      step: 1,
      fields: ['accountEmail', 'accountPassword', 'accountConfirmPassword'],
    },
    { step: 2, fields: ['businessType'] },
    {
      step: 3,
      fields: ['cep', 'street', 'neighborhood', 'city', 'state', 'number', 'mapConfirmed'],
    },
    { step: 4, fields: ['ownerName', 'phone', 'shopName', 'logoFile'] },
    {
      step: 5,
      fields: [
        'professionalsCount',
        'slotIntervalMinutes',
        'bufferMinutes',
        'timezone',
        'schedule.weekdaysStart',
        'schedule.weekdaysEnd',
        'schedule.saturdayStart',
        'schedule.saturdayEnd',
        'schedule.sundayStart',
        'schedule.sundayEnd',
      ],
    },
  ]

  for (const group of orderedFieldGroups) {
    if (group.fields.some((field) => Boolean(errors[field]))) {
      return group.step
    }
  }
  return 1
}

export function useWizardState() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const [pendingDraft, setPendingDraft] = useState<WizardDraftSnapshot | null>(() => readDraftFromStorage())
  const draftReady = true

  useEffect(() => {
    if (!draftReady || pendingDraft) return
    if (!hasDraftContent(state.data)) {
      window.localStorage.removeItem(SHOP_SIGNUP_DRAFT_KEY)
      return
    }
    if (!shouldPersistDraft(state)) {
      window.localStorage.removeItem(SHOP_SIGNUP_DRAFT_KEY)
      return
    }
    const serialized = serializeDraft(state)
    window.localStorage.setItem(SHOP_SIGNUP_DRAFT_KEY, JSON.stringify(serialized))
  }, [state, draftReady, pendingDraft])

  function setStep(step: WizardStep) {
    dispatch({ type: 'set_step', step: clampStep(step) })
  }

  function nextStep() {
    dispatch({ type: 'next_step' })
  }

  function prevStep() {
    dispatch({ type: 'prev_step' })
  }

  function setField<K extends keyof WizardData>(field: K, value: WizardData[K]) {
    dispatch({ type: 'set_field', field, value })
  }

  function setScheduleField<K extends keyof WizardSchedule>(field: K, value: WizardSchedule[K]) {
    dispatch({ type: 'set_schedule_field', field, value })
  }

  function setErrors(errors: WizardErrors) {
    dispatch({ type: 'set_errors', errors })
  }

  function clearDraftStorage() {
    window.localStorage.removeItem(SHOP_SIGNUP_DRAFT_KEY)
  }

  function resumeDraft() {
    if (!pendingDraft) return
    dispatch({ type: 'hydrate', draft: pendingDraft })
    setPendingDraft(null)
  }

  function discardDraft() {
    clearDraftStorage()
    setPendingDraft(null)
  }

  function resetWizard() {
    dispatch({ type: 'reset' })
  }

  function jumpToFirstInvalidStep(errors: WizardErrors) {
    setStep(resolveFirstInvalidStep(errors))
  }

  return {
    state,
    pendingDraft,
    draftReady,
    setStep,
    nextStep,
    prevStep,
    setField,
    setScheduleField,
    setErrors,
    clearDraftStorage,
    resumeDraft,
    discardDraft,
    resetWizard,
    jumpToFirstInvalidStep,
  }
}
