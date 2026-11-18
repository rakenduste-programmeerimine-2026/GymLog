import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigurationError } from '../lib/supabase'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  configurationError: string | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return

    let active = true
    let receivedAuthEvent = false

    // Keep this callback synchronous: awaiting auth methods here can deadlock.
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return
        receivedAuthEvent = true
        setSession(nextSession)
        setError(null)
        setLoading(false)
      },
    )

    // Also handle a failed initial session read, without overwriting newer events.
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || receivedAuthEvent) return
      setSession(sessionError ? null : data.session)
      setError(sessionError ? 'Sessiooni laadimine ebaõnnestus.' : null)
      setLoading(false)
    }).catch(() => {
      if (!active || receivedAuthEvent) return
      setError('Sessiooni laadimine ebaõnnestus.')
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    if (!supabase) {
      throw new Error(supabaseConfigurationError ?? 'Autentimine pole seadistatud.')
    }

    setError(null)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      // The auth subscription updates session and user on SIGNED_OUT.
    } catch {
      const message = 'Väljalogimine ebaõnnestus. Proovi uuesti.'
      setError(message)
      throw new Error(message)
    }
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      error,
      configurationError: supabaseConfigurationError,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
