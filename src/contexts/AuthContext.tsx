import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'

type ShopMember = Tables<'shop_members'>
type Shop = Tables<'shops'>

interface AuthState {
  user: User | null
  session: Session | null
  currentShop: Shop | null
  membership: ShopMember | null
  shops: Shop[]
  loading: boolean
  setCurrentShop: (shop: Shop, membership: ShopMember) => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [currentShop, setCurrentShopState] = useState<Shop | null>(null)
  const [membership, setMembership] = useState<ShopMember | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadShops(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadShops(session.user.id)
      } else {
        setShops([])
        setCurrentShopState(null)
        setMembership(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadShops(userId: string) {
    const { data: members } = await supabase
      .from('shop_members')
      .select('*, shops(*)')
      .eq('user_id', userId)

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
      } else {
        setCurrentShopState((members[0] as any).shops as Shop)
        setMembership(members[0])
      }
    } else {
      setShops([])
      setCurrentShopState(null)
      setMembership(null)
    }
    setLoading(false)
  }

  function setCurrentShop(shop: Shop, mem: ShopMember) {
    setCurrentShopState(shop)
    setMembership(mem)
    localStorage.setItem('barberage_current_shop', shop.id)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, currentShop, membership, shops, loading, setCurrentShop }}
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
