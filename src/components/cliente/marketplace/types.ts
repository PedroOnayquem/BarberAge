export type MarketplaceCityOption = {
  city: string
  state: string | null
}

export type MarketplaceShop = {
  id: string
  name: string
  slug: string
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  avatarSignedUrl: string | null
  can_book: boolean
  isPreferred: boolean
  services_count: number
  professionals_count: number
  statusLabel: string
  reason: string
}

