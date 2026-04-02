export const WIZARD_STEPS_TOTAL = 5
export const SHOP_SIGNUP_DRAFT_KEY = 'barberage:shop_signup_draft'

export type ShopTypeOptionId = 'traditional' | 'modern' | 'studio' | 'premium' | 'multi_unit'
export type StepNumber = 1 | 2 | 3 | 4 | 5
export type ScheduleBlockId = 'weekdays' | 'saturday' | 'sunday'

export interface ScheduleBlock {
  enabled: boolean
  start: string
  end: string
}

export interface WizardState {
  currentStep: StepNumber
  shopType: ShopTypeOptionId | null
  cep: string
  state: string
  city: string
  neighborhood: string
  street: string
  number: string
  complement: string
  latitude: number | null
  longitude: number | null
  locationConfirmed: boolean
  ownerName: string
  phone: string
  shopName: string
  logoFile: File | null
  logoPreviewUrl: string | null
  professionalsCount: string
  slotIntervalMinutes: string
  bufferMinutes: string
  timezone: string
  hours: Record<ScheduleBlockId, ScheduleBlock>
}

export interface WizardDraftState extends Omit<WizardState, 'logoFile' | 'logoPreviewUrl'> {}

export type WizardFieldName =
  | 'shopType'
  | 'cep'
  | 'state'
  | 'city'
  | 'neighborhood'
  | 'street'
  | 'number'
  | 'complement'
  | 'latitude'
  | 'longitude'
  | 'locationConfirmed'
  | 'ownerName'
  | 'phone'
  | 'shopName'
  | 'professionalsCount'
  | 'slotIntervalMinutes'
  | 'bufferMinutes'
  | 'timezone'

export type WizardErrors = Partial<Record<WizardFieldName | `${ScheduleBlockId}_hours`, string>>

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

export const TIMEZONE_OPTIONS = [
  { value: 'America/Fortaleza', label: 'GMT-3 Fortaleza (padrão)' },
  { value: 'America/Sao_Paulo', label: 'GMT-3 São Paulo' },
  { value: 'America/Recife', label: 'GMT-3 Recife' },
  { value: 'America/Manaus', label: 'GMT-4 Manaus' },
  { value: 'America/Rio_Branco', label: 'GMT-5 Rio Branco' },
  { value: 'America/Belem', label: 'GMT-3 Belém' },
]
