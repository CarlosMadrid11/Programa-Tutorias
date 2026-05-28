import { supabase } from './supabase'

export interface RpcOk<T = Record<string, unknown>> {
  ok: boolean
  mensaje?: string
  error?: string
  data?: T
}

function parseRpcError(err: { message: string } | null): string {
  if (!err) return 'Error desconocido'
  const m = err.message
  const match = m.match(/(?:ERROR|Exception):\s*(.+?)(?:\n|$)/i)
  return match?.[1]?.trim() ?? m
}

export async function gestionarUsuariosAdmin(
  accion: 'crear' | 'actualizar' | 'listar',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_usuarios_admin', {
    p_accion: accion,
    p_datos: datos,
  })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  if (payload && payload.ok === false) return { ok: false, error: String(payload.mensaje ?? 'Error') }
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarTutorados(
  accion: 'crear' | 'actualizar' | 'listar',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_tutorados', {
    p_accion: accion,
    p_datos: datos,
  })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  if (payload && payload.ok === false) return { ok: false, error: String(payload.mensaje ?? 'Error') }
  return { ok: true, data: payload ?? undefined }
}

export function validarPasswordNueva(password: string): { ok: boolean; error?: string } {
  if (password.length < 8) {
    return { ok: false, error: 'Mínimo 8 caracteres.' }
  }
  if (!/\d/.test(password)) {
    return { ok: false, error: 'Debe incluir al menos un número.' }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: 'Debe incluir al menos un carácter especial.' }
  }
  return { ok: true }
}

export async function cambiarPasswordInicial(
  passwordNueva: string,
  passwordConfirmacion: string,
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('cambiar_password_inicial', {
    p_password_nueva: passwordNueva,
    p_password_confirmacion: passwordConfirmacion,
  })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  if (payload && payload.ok === false) return { ok: false, error: String(payload.mensaje ?? 'Error') }
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarGrupoTutor(
  accion:
    | 'listar_grupos'
    | 'crear_grupo'
    | 'obtener_detalle'
    | 'actualizar_grupo'
    | 'eliminar_grupo'
    | 'resumen'
    | 'listar_tutorados'
    | 'asignar_tutorado'
    | 'desasignar',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_grupo_tutor', { p_accion: accion, p_datos: datos })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarMiTutorTutorado(): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_mi_tutor_tutorado')
  if (error) return { ok: false, error: parseRpcError(error) }
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined }
}

export async function gestionarActividadesGrupo(
  accion: 'listar' | 'actualizar_fecha',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_actividades_grupo', { p_accion: accion, p_datos: datos })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarSesionesGrupo(
  accion: 'listar' | 'vincular_actividad' | 'listar_actividades',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_sesiones_grupo', { p_accion: accion, p_datos: datos })
  if (error) return { ok: false, error: parseRpcError(error) }
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined }
}

export async function gestionarCalendarioTutorado(): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_calendario_tutorado')
  if (error) return { ok: false, error: parseRpcError(error) }
  return { ok: true, data: (data as Record<string, unknown>) ?? undefined }
}

export async function gestionarAsistenciasTutor(
  accion: 'listar_sesiones' | 'listar_matriz' | 'registrar' | 'crear_sesion' | 'matriz_semestre' | 'registrar_matriz',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_asistencias_tutor', { p_accion: accion, p_datos: datos })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarEvidenciasTutor(
  accion: 'listar' | 'evaluar' | 'actualizar_evaluacion' | 'promedios_grupo',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_evidencias_tutor', { p_accion: accion, p_datos: datos })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarEvidenciasTutorado(
  accion: 'entregar',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_evidencias_tutorado', {
    p_accion: accion,
    p_datos: datos,
  })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  if (payload && payload.ok === false) return { ok: false, error: String(payload.mensaje ?? 'Error') }
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarSeguimientoTutor(
  accion: 'listar_grupo' | 'reporte_intermedio',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_seguimiento_tutor', {
    p_accion: accion,
    p_datos: datos,
  })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  if (payload && payload.ok === false) return { ok: false, error: String(payload.mensaje ?? 'Error') }
  return { ok: true, data: payload ?? undefined }
}

export async function gestionarActividadesPt(
  accion: 'listar_programas' | 'listar' | 'crear' | 'actualizar' | 'cambiar_estado',
  datos: Record<string, unknown> = {},
): Promise<RpcOk> {
  const { data, error } = await supabase.rpc('gestionar_actividades_pt', {
    p_accion: accion,
    p_datos: datos,
  })
  if (error) return { ok: false, error: parseRpcError(error) }
  const payload = data as Record<string, unknown> | null
  if (payload && payload.ok === false) return { ok: false, error: String(payload.mensaje ?? 'Error') }
  return { ok: true, data: payload ?? undefined }
}
