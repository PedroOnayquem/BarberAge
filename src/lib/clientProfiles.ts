import type { User } from '@supabase/supabase-js'
import type { Tables } from '../types/database'

export interface ClientGlobalProfile {
  name: string | null
  phone: string | null
  email: string | null
}

type ClientProfileSource = Pick<Tables<'clients'>, 'name' | 'phone' | 'email'>
export type AuthAccountType = 'shop' | 'client' | null

function asNullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function resolveAuthAccountType(authUser?: User | null): AuthAccountType {
  const userMeta = (authUser?.user_metadata || {}) as Record<string, unknown>
  const metadataRole = userMeta.role
  const accountType = userMeta.account_type

  if (metadataRole === 'shop' || accountType === 'shop') return 'shop'
  if (metadataRole === 'client' || accountType === 'client') return 'client'
  return null
}

export function hasLegacyClientIdentity(authUser?: User | null): boolean {
  if (resolveAuthAccountType(authUser) === 'shop') return false

  const userMeta = (authUser?.user_metadata || {}) as Record<string, unknown>
  return Boolean(asNullableText(userMeta.name) || asNullableText(userMeta.phone))
}

export function buildClientGlobalProfile(
  authUser?: User | null,
  persistedProfile?: ClientProfileSource | null
): ClientGlobalProfile | null {
  const userMeta = (authUser?.user_metadata || {}) as Record<string, unknown>
  const name = persistedProfile?.name || asNullableText(userMeta.name)
  const phone = persistedProfile?.phone || asNullableText(userMeta.phone)
  const email = persistedProfile?.email || authUser?.email || asNullableText(userMeta.email)

  if (!name && !phone && !email) return null

  return {
    name: name ?? null,
    phone: phone ?? null,
    email,
  }
}

// The app now relies on auth metadata and `client_users` instead of the legacy
// `client_profiles` relation. Keep this helper as a no-op for compatibility.
export async function fetchClientGlobalProfile(_userId: string): Promise<null> {
  return null
}

export async function upsertClientGlobalProfile(_input: {
  userId: string
  name: string
  phone?: string | null
  email?: string | null
}) {
  return
}
