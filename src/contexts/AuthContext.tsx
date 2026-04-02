/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearLastAuthLoginMode, getLastAuthLoginMode } from '../lib/authFlow'
import {
  buildClientGlobalProfile,
  hasLegacyClientIdentity,
  resolveAuthAccountType,
  type ClientGlobalProfile,
} from '../lib/clientProfiles'
import type { Tables } from '../types/database'

type ShopMember = Tables<'shop_members'>
type Shop = Tables<'shops'>
type ClientUser = Tables<'client_users'>
type Client = Tables<'clients'>
type ClientUserWithRelations = ClientUser & { shops: Shop | null; clients: Client | null }
type ShopMemberWithRelations = ShopMember & { shops: Shop | null }

export type UserRole = 'admin' | 'professional' | 'reception' | 'client' | null

interface AuthState {
  user: User | null
  session: Session | null
  currentShop: Shop | null
  membership: ShopMember | null
  shops: Shop[]
  loading: boolean
  setCurrentShop: (shop: Shop, membership: ShopMember) => void
  userRole: UserRole
  clientUser: ClientUser | null
  clientProfile: Client | null
  clientGlobalProfile: ClientGlobalProfile | null
  clientShop: Shop | null
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const loadRequestRef = useRef(0)
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [currentShop, setCurrentShopState] = useState<Shop | null>(null)
  const [membership, setMembership] = useState<ShopMember | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [clientUser, setClientUser] = useState<ClientUser | null>(null)
  const [clientProfile, setClientProfile] = useState<Client | null>(null)
  const [clientGlobalProfile, setClientGlobalProfile] = useState<ClientGlobalProfile | null>(null)
  const [clientShop, setClientShop] = useState<Shop | null>(null)

  function resetState() {
    loadRequestRef.current += 1
    setShops([])
    setCurrentShopState(null)
    setMembership(null)
    setUserRole(null)
    setClientUser(null)
    setClientProfile(null)
    setClientGlobalProfile(null)
    setClientShop(null)
    clearLastAuthLoginMode()
    setLoading(false)
  }

  function setPreferredUserRole(params: {
    members: ShopMemberWithRelations[]
    selectedMembership: ShopMemberWithRelations | null
    hasClientAccess: boolean
    authAccountType: ReturnType<typeof resolveAuthAccountType>
  }) {
    const { members, selectedMembership, hasClientAccess, authAccountType } = params
    const preferredMode = getLastAuthLoginMode()

    if (preferredMode === 'client' && hasClientAccess) {
      setUserRole('client')
      return
    }

    if (selectedMembership) {
      setUserRole(selectedMembership.role as UserRole)
      return
    }

    if (members.length > 0) {
      setUserRole(members[0].role as UserRole)
      return
    }

    if (hasClientAccess && authAccountType !== 'shop') {
      setUserRole('client')
      return
    }

    setUserRole(null)
  }

  async function loadUserData(userId: string, authUser?: User) {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setShops([])
    setCurrentShopState(null)
    setMembership(null)
    setUserRole(null)
    setClientUser(null)
    setClientProfile(null)
    setClientGlobalProfile(null)
    setClientShop(null)

    try {
      const [membersRes, clientUsersRes] = await Promise.all([
        supabase.from('shop_members').select('*, shops(*)').eq('user_id', userId),
        supabase.from('client_users').select('*, shops(*), clients(*)').eq('user_id', userId),
      ])

      if (requestId !== loadRequestRef.current) return

      const members = (membersRes.data || []) as ShopMemberWithRelations[]
      const clientUsers = (clientUsersRes.data || []) as ClientUserWithRelations[]
      const primaryClientUser = clientUsers[0] || null
      const authAccountType = resolveAuthAccountType(authUser)
      const hasClientAccess =
        clientUsers.length > 0 ||
        authAccountType === 'client' ||
        hasLegacyClientIdentity(authUser)
      const shopList = members
        .map((member) => member.shops)
        .filter((shop): shop is Shop => Boolean(shop))
      const savedShopId = window.localStorage.getItem('barberage_current_shop')
      const selectedMembership =
        members.find((member) => member.shop_id === savedShopId && member.shops) ||
        members.find((member) => Boolean(member.shops)) ||
        null

      if (shopList.length > 0) {
        setShops(shopList)

        if (selectedMembership?.shops) {
          setCurrentShopState(selectedMembership.shops)
          setMembership(selectedMembership)
        }
      }

      if (primaryClientUser) {
        setClientUser(primaryClientUser)
        setClientShop(primaryClientUser.shops)
        setClientProfile(primaryClientUser.clients)
      }

      const nextClientGlobalProfile = hasClientAccess
        ? buildClientGlobalProfile(authUser, primaryClientUser?.clients || null)
        : null

      if (nextClientGlobalProfile) {
        setClientGlobalProfile(nextClientGlobalProfile)
      }

      setPreferredUserRole({
        members,
        selectedMembership,
        hasClientAccess,
        authAccountType,
      })
    } catch (error) {
      if (requestId !== loadRequestRef.current) return
      if (import.meta.env.DEV) {
        console.error('[auth] failed to load user data', error)
      }
      setUserRole(null)
      if (resolveAuthAccountType(authUser) === 'client' || hasLegacyClientIdentity(authUser)) {
        setClientGlobalProfile(buildClientGlobalProfile(authUser, null))
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let active = true

    async function syncSession() {
      setLoading(true)
      const { data: { session: nextSession } } = await supabase.auth.getSession()
      if (!active) return

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        await loadUserData(nextSession.user.id, nextSession.user)
      } else {
        resetState()
      }
    }

    void syncSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (nextSession?.user) {
        void loadUserData(nextSession.user.id, nextSession.user)
      } else {
        resetState()
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function refreshUserData() {
    const currentUserId = user?.id ?? session?.user?.id
    if (!currentUserId) return
    setLoading(true)
    await loadUserData(currentUserId, user ?? session?.user ?? undefined)
  }

  function setCurrentShop(shop: Shop, mem: ShopMember) {
    setCurrentShopState(shop)
    setMembership(mem)
    setUserRole(mem.role as UserRole)
    localStorage.setItem('barberage_current_shop', shop.id)
  }

  return (
    <AuthContext.Provider
      value={{
        user, session, currentShop, membership, shops, loading, setCurrentShop,
        userRole, clientUser, clientProfile, clientGlobalProfile, clientShop, refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
