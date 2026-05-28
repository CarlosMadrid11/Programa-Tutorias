import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../utils/supabase'
import type { Tables } from '../types/database.types'
import { AuthContext } from './authContextInstance'

type SistemaRow = Tables<'sistema'>

// Solo exporta el componente Provider → fast refresh no se queja
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<SistemaRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const { data } = await supabase
          .from('sistema')
          .select('*')
          .eq('id_sistema', session.user.id)
          .single()

        setUser(data)
      }

      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data } = await supabase
            .from('sistema')
            .select('*')
            .eq('id_sistema', session.user.id)
            .single()

          setUser(data)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}