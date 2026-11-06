import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthStatusValue {
  session: Session | null
  user: User | null
  loading: boolean
  sessionExpired: boolean
  markExplicitSignOut: () => void
}

const AuthStatusContext = createContext<AuthStatusValue | null>(null)

export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const hadSession = useRef(false)
  const explicitSignOut = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      hadSession.current = Boolean(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' && hadSession.current && !explicitSignOut.current) setSessionExpired(true)
      if (nextSession) {
        hadSession.current = true
        explicitSignOut.current = false
        setSessionExpired(false)
      }
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthStatusContext.Provider value={{
    session,
    user: session?.user ?? null,
    loading,
    sessionExpired,
    markExplicitSignOut: () => {
      explicitSignOut.current = true
      setSessionExpired(false)
    },
  }}>{children}</AuthStatusContext.Provider>
}

export function useAuthStatus() {
  const value = useContext(AuthStatusContext)
  if (!value) throw new Error('useAuthStatus must be used within AuthStatusProvider')
  return value
}
