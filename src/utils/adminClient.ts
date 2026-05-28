import { createClient } from '@supabase/supabase-js'

export function createNoSessionClient() {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )
}
