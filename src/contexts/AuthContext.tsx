import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'

type ShopMember = Tables<'shop_members'>
type Shop = Tables<'shops'>
type ClientUser = Tables<'client_users'>
type Client = Tables<'clients'>

interface ClientGlobalProfile {
  name: string | null
  phone: string | null
  email: string | null
}

export type UserRole = 'admin' | 'professional' | 'reception' | 'client' | null

interface AuthState {
  user: User | null
  session: Session | null
  currentShop: Shop | null
  membership: ShopMember | null
  shops: Shop[]
  loading: boolean
  setCurrentShop: (shop: Shop, membership: ShopMember) => void
  // Client-specific state
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        void loadUserData(session.user.id, session.user)
      } else {
        resetState()
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        void loadUserData(session.user.id, session.user)
      } else {
        resetState()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
    setLoading(false)
  }

  async function loadUserData(userId: string, authUser?: User) {
    const requestId = ++loadRequestRef.current

    // Clear stale role-linked data before reloading
    setShops([])
    setCurrentShopState(null)
    setMembership(null)
    setClientUser(null)
    setClientProfile(null)
    setClientGlobalProfile(null)
    setClientShop(null)

    try {
      // Load memberships + client links in parallel
      const [membersRes, clientUsersRes] = await Promise.all([
        supabase.from('shop_members').select('*, shops(*)').eq('user_id', userId),
        supabase.from('client_users').select('*, shops(*), clients(*)').eq('user_id', userId),
      ])

      if (requestId !== loadRequestRef.current) return

      if (membersRes.error && import.meta.env.DEV) {
        console.error('[auth] loadUserData shop_members error', membersRes.error)
      }
      if (clientUsersRes.error && import.meta.env.DEV) {
        console.error('[auth] loadUserData client_users error', clientUsersRes.error)
      }

      const members = membersRes.data || []
      const clientUsers = clientUsersRes.data || []
      const meta = (authUser?.user_metadata || {}) as Record<string, unknown>
      const isClientFromMetadata =
        meta.role === 'client' || meta.account_type === 'client'
      const hasClientIdentity = isClientFromMetadata || clientUsers.length > 0
      const globalClientProfile: ClientGlobalProfile | null =
        hasClientIdentity
          ? {
              name: typeof meta.name === 'string' ? meta.name : null,
              phone: typeof meta.phone === 'string' ? meta.phone : null,
              email: authUser?.email ?? null,
            }
          : null

      // Check if user is a shop member
      if (members.length > 0) {
        const shopList = members
          .map((m) => (m as any).shops as Shop)
          .filter(Boolean)
        setShops(shopList)

        const savedShopId = localStorage.getItem('barberage_current_shop')
        const savedMember = members.find((m) => m.shop_id === savedShopId)

        if (savedMember && (savedMember as any).shops) {
          setCurrentShopState((savedMember as any).shops as Shop)
          setMembership(savedMember)
          setUserRole(savedMember.role as UserRole)
        } else {
          setCurrentShopState((members[0] as any).shops as Shop)
          setMembership(members[0])
          setUserRole(members[0].role as UserRole)
        }
      }

      // Check if user is a client
      if (clientUsers.length > 0) {
        setClientUser(clientUsers[0])
        setClientShop((clientUsers[0] as any).shops as Shop)
        setClientProfile((clientUsers[0] as any).clients as Client)
      }

      if (globalClientProfile) {
        setClientGlobalProfile(globalClientProfile)
      }

      // If not a shop member, client role only exists when there is an explicit client marker.
      if (members.length === 0 && hasClientIdentity) {
        setUserRole('client')
      }

      // If neither, leave role as null (new user, needs onboarding)
      if (members.length === 0 && !hasClientIdentity) {
        setUserRole(null)
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false)
      }
    }
  }

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
