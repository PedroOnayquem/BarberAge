export const DEFAULT_SERVICE_CATEGORIES = [
  {
    slug: 'barbershop',
    name: 'Barbearia',
    description: 'Cabelo, barba e cuidados masculinos.',
    keywords: ['barbearia', 'barba', 'corte', 'cabelo'],
  },
  {
    slug: 'manicure',
    name: 'Manicure',
    description: 'Unhas, esmaltação e cuidados com mãos e pés.',
    keywords: ['manicure', 'unha', 'pedicure', 'esmalte'],
  },
  {
    slug: 'car_wash',
    name: 'Lava-jato',
    description: 'Lavagem, estética automotiva e higienização.',
    keywords: ['lava-jato', 'lavagem', 'carro', 'automotiva'],
  },
  {
    slug: 'aesthetics',
    name: 'Estética',
    description: 'Procedimentos estéticos, pele e bem-estar.',
    keywords: ['estética', 'pele', 'limpeza', 'beleza'],
  },
  {
    slug: 'massage',
    name: 'Massagem',
    description: 'Massoterapia, relaxamento e terapias corporais.',
    keywords: ['massagem', 'massoterapia', 'relaxamento'],
  },
  {
    slug: 'pet_care',
    name: 'Cuidados pet',
    description: 'Banho, tosa e serviços para pets.',
    keywords: ['pet', 'banho', 'tosa'],
  },
] as const

export type ServiceCategorySlug = (typeof DEFAULT_SERVICE_CATEGORIES)[number]['slug']

export const ALL_CATEGORIES_FILTER = 'all'

export type MarketplaceCategoryFilter = typeof ALL_CATEGORIES_FILTER | ServiceCategorySlug

export function getServiceCategoryLabel(slug: string) {
  return DEFAULT_SERVICE_CATEGORIES.find((category) => category.slug === slug)?.name || slug
}

export function getServiceCategoryDescription(slug: string) {
  return DEFAULT_SERVICE_CATEGORIES.find((category) => category.slug === slug)?.description || ''
}
