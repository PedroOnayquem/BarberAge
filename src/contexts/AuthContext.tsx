import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'

type ShopMember = Tables<'shop_members'>
type Shop = Tables<'shops'>
type ClientUser = Tables<'client_users'>

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
  clientShop: Shop | null
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [currentShop, setCurrentShopState] = useState<Shop | null>(null)
  const [membership, setMembership] = useState<ShopMember | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [clientUser, setClientUser] = useState<ClientUser | null>(null)
  const [clientShop, setClientShop] = useState<Shop | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadUserData(session.user.id)
      } else {
        resetState()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function resetState() {
    setShops([])
    setCurrentShopState(null)
    setMembership(null)
    setUserRole(null)
    setClientUser(null)
    setClientShop(null)
    setLoading(false)
  }

  async function loadUserData(userId: string) {
    // Clear stale role-linked data before reloading
    setShops([])
    setCurrentShopState(null)
    setMembership(null)
    setClientUser(null)
    setClientShop(null)

    // Load both shop memberships and client links in parallel
    const [membersRes, clientUsersRes] = await Promise.all([
      supabase.from('shop_members').select('*, shops(*)').eq('user_id', userId),
      supabase.from('client_users').select('*, shops(*)').eq('user_id', userId),
    ])

    const members = membersRes.data
    const clientUsers = clientUsersRes.data

    // Check if user is a shop member
    if (members && members.length > 0) {
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
    if (clientUsers && clientUsers.length > 0) {
      setClientUser(clientUsers[0])
      setClientShop((clientUsers[0] as any).shops as Shop)
      // If not a shop member, set role to client
      if (!members || members.length === 0) {
        setUserRole('client')
      }
    }

    // If neither, leave role as null (new user, needs to create shop or register as client)
    if ((!members || members.length === 0) && (!clientUsers || clientUsers.length === 0)) {
      setUserRole(null)
    }

    setLoading(false)
  }

  async function refreshUserData() {
    const currentUserId = user?.id ?? session?.user?.id
    if (!currentUserId) return
    setLoading(true)
    await loadUserData(currentUserId)
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
        userRole, clientUser, clientShop, refreshUserData,
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
