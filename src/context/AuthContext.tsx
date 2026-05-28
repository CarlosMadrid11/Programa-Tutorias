import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'
import type { Perfil, RolUsuario } from '../types/database.types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  perfil: Perfil | null
  rol: RolUsuario | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user,    setUser]    = useState<User | null>(null)
  const [perfil,  setPerfil]  = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  const clearAuthState = () => {
    setSession(null)
    setUser(null)
    setPerfil(null)
  }

  const clearBrowserCredentials = () => {
    if (typeof window === 'undefined') return
    const clearStore = (store: Storage) => {
      const keysToRemove: string[] = []
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i)
        if (!key) continue
        const normalized = key.toLowerCase()
        if (
          normalized.includes('supabase') ||
          normalized.includes('auth-token') ||
          normalized.includes('sb-')
        ) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => store.removeItem(k))
    }
    clearStore(window.localStorage)
    clearStore(window.sessionStorage)
  }

  const fetchPerfil = async (userId: string): Promise<Perfil | null> => {
    console.log('fetchPerfil: querying database for userId:', userId)
    try {
      const queryPromise = supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 4000)
      )

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

      if (error) {
        console.error('fetchPerfil: Error fetching profile from Supabase:', error)
        return null
      }
      console.log('fetchPerfil: query result:', data)
      return (data as Perfil | null) ?? null
    } catch (err: any) {
      if (err?.message === 'TIMEOUT_EXCEEDED') {
        console.error('fetchPerfil: La consulta a la base de datos excedió el límite de 4 segundos (TIMEOUT).')
      } else {
        console.error('fetchPerfil: Error inesperado:', err)
      }
      return null
    }
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const fetchPerfilWithRetry = async (userId: string): Promise<Perfil | null> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const perfilData = await fetchPerfil(userId)
      if (perfilData) return perfilData
      await wait(300)
    }
    return null
  }

  // Ref to hold current perfil without triggering re-renders in the listener
  let perfilRef: Perfil | null = null

  const applySession = async (nextSession: Session | null, forceRefetch = false): Promise<boolean> => {
    setSession(nextSession)
    setUser(nextSession?.user ?? null)
    if (nextSession?.user) {
      // If we already have a profile in memory and this is just a token refresh, skip DB query
      if (perfilRef && !forceRefetch) {
        console.log('applySession: Token refreshed, keeping existing profile in memory.')
        return true
      }
      console.log('applySession: Fetching profile for user:', nextSession.user.id)
      const perfilData = await fetchPerfilWithRetry(nextSession.user.id)
      if (!perfilData) {
        console.warn('applySession: Profile not found for user ID:', nextSession.user.id)
        setPerfil(null)
        perfilRef = null
        return true
      }
      console.log('applySession: Profile loaded successfully:', perfilData)
      perfilRef = perfilData
      setPerfil(perfilData)
    } else {
      setPerfil(null)
      perfilRef = null
    }
    return true
  }

  useEffect(() => {
    let mounted = true
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 6000)

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!mounted) return
        if (!data.session) {
          clearAuthState()
          return
        }
        await applySession(data.session, true)
      } catch {
        if (!mounted) return
        clearAuthState()
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return
        console.log('onAuthStateChange event:', event)
        try {
          if (event === 'SIGNED_OUT' || !nextSession) {
            clearAuthState()
            perfilRef = null
          } else if (event === 'TOKEN_REFRESHED') {
            // Just update the session object, keep the existing profile
            setSession(nextSession)
            setUser(nextSession.user ?? null)
            console.log('TOKEN_REFRESHED: session updated, profile kept intact.')
          } else {
            // SIGNED_IN, INITIAL_SESSION, USER_UPDATED, etc. — fetch/re-fetch profile
            await applySession(nextSession, true)
          }
        } catch {
          if (!mounted) return
        } finally {
          if (mounted) setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(failsafe)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (!data.session) return { error: 'No se pudo crear la sesión.' }
    const applied = await applySession(data.session)
    if (!applied) return { error: 'Tu usuario no tiene perfil/configuración de rol disponible.' }
    return { error: null }
  }

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'global' }),
        new Promise((resolve) => setTimeout(resolve, 3500)),
      ])
    } finally {
      clearAuthState()
      clearBrowserCredentials()
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, perfil, rol: perfil?.rol ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
