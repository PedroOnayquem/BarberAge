import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
}

function extractProjectRefFromUrl(url: string): string | null {
  const match = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i)
  return match?.[1] || null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

if (import.meta.env.DEV) {
  const refFromUrl = extractProjectRefFromUrl(supabaseUrl)
  const payload = decodeJwtPayload(supabaseAnonKey)
  const refFromKey = typeof payload?.ref === 'string' ? payload.ref : null

  if (!refFromUrl || !refFromKey) {
    console.warn('[supabase][dev-check] Não foi possível validar projeto por URL/chave.')
  } else if (refFromUrl !== refFromKey) {
    console.error(
      `[supabase][dev-check] Projeto inconsistente: URL aponta para '${refFromUrl}', ` +
      `mas ANON key pertence a '${refFromKey}'.`
    )
  } else {
    console.info(`[supabase][dev-check] URL e ANON key apontam para o mesmo projeto: '${refFromUrl}'.`)
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
