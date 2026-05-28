import { createContext } from 'react'
import type { Tables } from '../types/database.types'

type SistemaRow = Tables<'sistema'>

export interface AuthState {
  user: SistemaRow | null
  loading: boolean
  logout: () => Promise<void>
}

// Solo crea y exporta el objeto contexto
// AuthProvider lo usa, useAuth lo usa — ninguno lo crea
export const AuthContext = createContext<AuthState | null>(null)