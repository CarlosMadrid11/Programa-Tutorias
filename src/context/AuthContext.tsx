import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  refreshPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user,    setUser]    = useState<User | null>(null)
  const [perfil,  setPerfil]  = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  const perfilRef = useRef<Perfil | null>(null)
  const profileUserIdRef = useRef<string | null>(null)
  const lastAccessTokenRef = useRef<string | null>(null)
  const fetchInFlightRef = useRef<Promise<Perfil | null> | null>(null)
  const fetchInFlightUserIdRef = useRef<string | null>(null)
  const sessionHydratedRef = useRef(false)

  const syncPerfil = (data: Perfil | null, userId: string | null) => {
    perfilRef.current = data
    profileUserIdRef.current = userId
    setPerfil(data)
  }

  const clearAuthState = () => {
    setSession(null)
    setUser(null)
    syncPerfil(null, null)
    lastAccessTokenRef.current = null
    fetchInFlightRef.current = null
    fetchInFlightUserIdRef.current = null
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
    if (fetchInFlightRef.current && fetchInFlightUserIdRef.current === userId) {
      return fetchInFlightRef.current
    }

    const query = (async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('fetchPerfil: error al consultar perfil:', error.message)
        return null
      }
      return (data as Perfil | null) ?? null
    })()

    fetchInFlightRef.current = query
    fetchInFlightUserIdRef.current = userId

    try {
      return await query
    } finally {
      if (fetchInFlightRef.current === query) {
        fetchInFlightRef.current = null
        fetchInFlightUserIdRef.current = null
      }
    }
  }

  const loadPerfilIfNeeded = async (
    userId: string,
    options?: { force?: boolean },
  ): Promise<Perfil | null> => {
    const force = options?.force ?? false

    if (!force && profileUserIdRef.current === userId && perfilRef.current) {
      return perfilRef.current
    }

    const perfilData = await fetchPerfil(userId)
    if (perfilData) {
      syncPerfil(perfilData, userId)
      return perfilData
    }

    if (profileUserIdRef.current === userId && perfilRef.current) {
      console.warn('fetchPerfil: falló la consulta; se conserva el perfil en caché.')
      return perfilRef.current
    }

    return null
  }

  const applySession = async (
    nextSession: Session | null,
    options?: { forcePerfil?: boolean },
  ): Promise<boolean> => {
    if (!nextSession?.user) {
      clearAuthState()
      return true
    }

    const userId = nextSession.user.id
    const accessToken = nextSession.access_token
    const forcePerfil = options?.forcePerfil ?? false
    const hasCachedProfile =
      profileUserIdRef.current === userId && perfilRef.current !== null
    const sameToken = lastAccessTokenRef.current === accessToken

    setSession(nextSession)
    setUser(nextSession.user)
    lastAccessTokenRef.current = accessToken

    if (!forcePerfil && hasCachedProfile && sameToken) {
      return true
    }

    if (!forcePerfil && hasCachedProfile) {
      return true
    }

    await loadPerfilIfNeeded(userId, { force: forcePerfil })
    return true
  }

  useEffect(() => {
    let mounted = true
    const failsafe = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    const finishLoading = () => {
      if (mounted) setLoading(false)
    }

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!mounted) return
        if (!data.session) {
          clearAuthState()
          return
        }
        sessionHydratedRef.current = true
        await applySession(data.session)
      } catch {
        if (!mounted) return
        clearAuthState()
      } finally {
        finishLoading()
      }
    }

    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return

        void (async () => {
          try {
            if (event === 'SIGNED_OUT' || !nextSession) {
              clearAuthState()
              return
            }

            if (event === 'TOKEN_REFRESHED') {
              setSession(nextSession)
              setUser(nextSession.user ?? null)
              lastAccessTokenRef.current = nextSession.access_token
              return
            }

            const userId = nextSession.user.id
            const hasCachedProfile =
              profileUserIdRef.current === userId && perfilRef.current !== null

            if (event === 'INITIAL_SESSION' && sessionHydratedRef.current && hasCachedProfile) {
              setSession(nextSession)
              setUser(nextSession.user ?? null)
              lastAccessTokenRef.current = nextSession.access_token
              return
            }

            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && hasCachedProfile) {
              setSession(nextSession)
              setUser(nextSession.user ?? null)
              lastAccessTokenRef.current = nextSession.access_token
              return
            }

            const userChanged = profileUserIdRef.current !== null && profileUserIdRef.current !== userId
            const forcePerfil = event === 'USER_UPDATED' || userChanged

            sessionHydratedRef.current = true
            await applySession(nextSession, { forcePerfil })
          } catch {
            if (!mounted) return
          } finally {
            finishLoading()
          }
        })()
      },
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

    const userChanged =
      profileUserIdRef.current !== null &&
      profileUserIdRef.current !== data.session.user.id

    const applied = await applySession(data.session, { forcePerfil: userChanged })
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

  const refreshPerfil = async () => {
    const userId = user?.id ?? session?.user?.id
    if (!userId) return
    fetchInFlightRef.current = null
    await loadPerfilIfNeeded(userId, { force: true })
  }

  return (
    <AuthContext.Provider value={{ session, user, perfil, rol: perfil?.rol ?? null, loading, signIn, signOut, refreshPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
