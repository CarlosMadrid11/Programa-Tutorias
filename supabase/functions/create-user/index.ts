import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: callerPerfil } = await callerClient.from('perfiles').select('rol').eq('id', caller.id).single()
    const callerRol = (callerPerfil as { rol: string } | null)?.rol
    if (!['coordinador_institucional', 'jefe_desarrollo_academico'].includes(callerRol ?? '')) {
      return new Response(JSON.stringify({ error: 'No autorizado para crear usuarios' }), { status: 403, headers: corsHeaders })
    }

    const { email, password, metadata } = await req.json()
    if (!email || !password) return new Response(JSON.stringify({ error: 'Email y contraseña requeridos' }), { status: 400, headers: corsHeaders })

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...metadata,
        creado_por: caller.id,
      },
    })

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    return new Response(JSON.stringify({ user: data.user }), { status: 200, headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
