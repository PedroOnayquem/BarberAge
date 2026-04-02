export type AuthLoginMode = 'shop' | 'client'

const AUTH_LOGIN_MODE_KEY = 'barberage_last_login_mode'

function hasWindow() {
  return typeof window !== 'undefined'
}

export function setLastAuthLoginMode(mode: AuthLoginMode) {
  if (!hasWindow()) return
  window.localStorage.setItem(AUTH_LOGIN_MODE_KEY, mode)
}

export function getLastAuthLoginMode(): AuthLoginMode | null {
  if (!hasWindow()) return null
  const mode = window.localStorage.getItem(AUTH_LOGIN_MODE_KEY)
  return mode === 'shop' || mode === 'client' ? mode : null
}

export function clearLastAuthLoginMode() {
  if (!hasWindow()) return
  window.localStorage.removeItem(AUTH_LOGIN_MODE_KEY)
}

export function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'))
}

export function getAuthNextPath(search: string): string | null {
  const next = new URLSearchParams(search).get('next')
  return isSafeInternalPath(next) ? next : null
}

export function withAuthNextPath(basePath: string, nextPath: string | null) {
  if (!isSafeInternalPath(nextPath)) return basePath
  return `${basePath}?next=${encodeURIComponent(nextPath)}`
}

export function redirectAfterAuth(path: string) {
  if (!hasWindow()) return
  window.location.replace(path)
}
