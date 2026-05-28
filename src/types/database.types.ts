export type RolUsuario =
  | 'coordinador_institucional'
  | 'coordinador_departamental'
  | 'jefe_departamento'
  | 'jefe_desarrollo_academico'
  | 'tutor'
  | 'tutorado'
  | 'director'
  | 'subdirector'

export type EstadoRegistro  = 'activo' | 'inactivo' | 'baja'
export type TipoSesion      = 'grupal' | 'individual' | 'virtual' | 'plenaria'
export type FasePT          = 'diagnostico' | 'planeacion' | 'acompanamiento' | 'seguimiento' | 'evaluacion'
export type EstadoActividad = 'activa' | 'cerrada' | 'bloqueada'
export type EstadoAsistencia= 'presente' | 'ausente' | 'justificado'
export type EstadoEvidencia = 'pendiente' | 'entregada' | 'aceptada' | 'requiere_correccion' | 'rechazada'
export type TipoEvaluacion  = 'parcial_1' | 'parcial_2' | 'final'
export type EstadoAcreditacion = 'al_corriente' | 'en_riesgo' | 'atencion_urgente' | 'acreditado' | 'no_acreditado'

export interface Perfil {
  id: string
  rol: RolUsuario
  nombre_completo: string
  correo_institucional: string
  numero_empleado?: string | null
  numero_control?: string | null
  telefono?: string | null
  departamento?: string | null
  carrera?: string | null
  estado: EstadoRegistro
  primer_acceso: boolean
  password_temporal?: string | null
  creado_por?: string | null
  creado_en: string
  actualizado_en: string
}

export interface PeriodoEscolar {
  id: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  creado_en: string
}

export interface ProgramaTutorias {
  id: string
  periodo_id: string
  nombre: string
  descripcion?: string | null
  objetivo_general?: string | null
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  creado_por: string
  creado_en: string
  actualizado_en: string
}

export interface ActividadPT {
  id: string
  programa_id: string
  nombre: string
  descripcion?: string | null
  tipo_sesion: TipoSesion
  fase: FasePT
  fecha_programada: string
  requiere_evidencia: boolean
  tipo_archivo_aceptado?: string[] | null
  fecha_limite_evidencia?: string | null
  estado: EstadoActividad
  bloqueada_modificacion: boolean
  creado_por: string
  creado_en: string
  actualizado_en: string
}

export interface AsignacionTutor {
  id: string
  periodo_id: string
  tutor_id: string
  carrera: string
  semestre_generacional: string
  grupo: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  salon: string
  activa: boolean
  asignado_por: string
  creado_en: string
  actualizado_en: string
}

export interface AsignacionTutorado {
  id: string
  asignacion_id: string
  tutorado_id: string
  periodo_id: string
  fecha_asignacion: string
  activa: boolean
  justificacion_reasignacion?: string | null
  asignado_por: string
  creado_en: string
}

export interface Sesion {
  id: string
  asignacion_id: string
  actividad_pt_id?: string | null
  fecha_realizada: string
  aula?: string | null
  descripcion?: string | null
  es_extraordinaria: boolean
  justificacion_ext?: string | null
  cerrada: boolean
  creado_por: string
  creado_en: string
}

export interface Asistencia {
  id: string
  sesion_id: string
  tutorado_id: string
  estado: EstadoAsistencia
  observaciones?: string | null
  fecha_captura: string
  capturado_por: string
}

export interface Evidencia {
  id: string
  actividad_pt_id: string
  tutorado_id: string
  periodo_id: string
  archivo_url?: string | null
  archivo_nombre?: string | null
  archivo_tipo?: string | null
  archivo_tamano_kb?: number | null
  comentario_alumno?: string | null
  estado: EstadoEvidencia
  retroalimentacion?: string | null
  evaluada_por?: string | null
  fecha_entrega: string
  fecha_evaluacion?: string | null
  version: number
  creado_en: string
}

export interface Evaluacion {
  id: string
  tutorado_id: string
  asignacion_id: string
  periodo_id: string
  tipo: TipoEvaluacion
  calificacion_personal?: number | null
  calificacion_academica?: number | null
  calificacion_profesional?: number | null
  calificacion_final?: number | null
  observaciones?: string | null
  recomendaciones?: string | null
  estado_tutorado?: EstadoAcreditacion | null
  requiere_canalizacion: boolean
  evaluado_por: string
  creado_en: string
  actualizado_en: string
}

export interface Acreditacion {
  id: string
  tutorado_id: string
  periodo_id: string
  asignacion_id: string
  acreditado: boolean
  porcentaje_asistencia?: number | null
  calificacion_final?: number | null
  motivo_no_acreditacion?: string | null
  numero_folio?: string | null
  pdf_url?: string | null
  generado_por: string
  fecha_generacion: string
}

export interface AlertaSistema {
  id: string
  tipo: string
  tutorado_id: string
  tutor_id?: string | null
  mensaje: string
  resuelta: boolean
  creado_en: string
}

export interface ResumenTutorado {
  tutorado_id: string
  nombre_completo: string
  numero_control: string | null
  carrera: string | null
  periodo_id: string
  periodo_nombre: string | null
  tutor_nombre: string | null
  total_sesiones: number | null
  sesiones_presentes: number | null
  evidencias_entregadas: number | null
  calificacion_final: number | null
  estado_acreditacion: EstadoAcreditacion | null
}

export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: Perfil
        Insert: Omit<Perfil, 'creado_en' | 'actualizado_en'>
        Update: Partial<Omit<Perfil, 'id' | 'creado_en' | 'actualizado_en'>>
        Relationships: []
      }
      periodos_escolares: {
        Row: PeriodoEscolar
        Insert: Omit<PeriodoEscolar, 'id' | 'creado_en'>
        Update: Partial<Omit<PeriodoEscolar, 'id' | 'creado_en'>>
        Relationships: []
      }
      programas_tutorias: {
        Row: ProgramaTutorias
        Insert: Omit<ProgramaTutorias, 'id' | 'creado_en' | 'actualizado_en'>
        Update: Partial<Omit<ProgramaTutorias, 'id' | 'creado_en' | 'actualizado_en'>>
        Relationships: []
      }
      actividades_pt: {
        Row: ActividadPT
        Insert: Omit<ActividadPT, 'id' | 'creado_en' | 'actualizado_en'>
        Update: Partial<Omit<ActividadPT, 'id' | 'creado_en' | 'actualizado_en'>>
        Relationships: []
      }
      asignaciones_tutor: {
        Row: AsignacionTutor
        Insert: Omit<AsignacionTutor, 'id' | 'creado_en' | 'actualizado_en'>
        Update: Partial<Omit<AsignacionTutor, 'id' | 'creado_en' | 'actualizado_en'>>
        Relationships: []
      }
      asignaciones_tutorado: {
        Row: AsignacionTutorado
        Insert: Omit<AsignacionTutorado, 'id' | 'creado_en'>
        Update: Partial<Omit<AsignacionTutorado, 'id' | 'creado_en'>>
        Relationships: []
      }
      sesiones: {
        Row: Sesion
        Insert: Omit<Sesion, 'id' | 'creado_en'>
        Update: Partial<Omit<Sesion, 'id' | 'creado_en'>>
        Relationships: []
      }
      asistencias: {
        Row: Asistencia
        Insert: Omit<Asistencia, 'id'>
        Update: Partial<Omit<Asistencia, 'id'>>
        Relationships: []
      }
      evidencias: {
        Row: Evidencia
        Insert: Omit<Evidencia, 'id' | 'creado_en' | 'version'>
        Update: Partial<Omit<Evidencia, 'id' | 'creado_en'>>
        Relationships: []
      }
      evaluaciones: {
        Row: Evaluacion
        Insert: Omit<Evaluacion, 'id' | 'creado_en' | 'actualizado_en'>
        Update: Partial<Omit<Evaluacion, 'id' | 'creado_en' | 'actualizado_en'>>
        Relationships: []
      }
      acreditaciones: {
        Row: Acreditacion
        Insert: Omit<Acreditacion, 'id'>
        Update: Partial<Omit<Acreditacion, 'id'>>
        Relationships: []
      }
      alertas_sistema: {
        Row: AlertaSistema
        Insert: Omit<AlertaSistema, 'id' | 'creado_en'>
        Update: Partial<Pick<AlertaSistema, 'resuelta'>>
        Relationships: []
      }
    }
    Views: {
      v_resumen_tutorado: {
        Row: ResumenTutorado
        Relationships: []
      }
    }
    Functions: {
      fn_porcentaje_asistencia: {
        Args: { p_tutorado_id: string; p_periodo_id: string }
        Returns: number
      }
      fn_get_rol_usuario: {
        Args: Record<string, never>
        Returns: RolUsuario
      }
      fn_tiene_rol: {
        Args: { p_rol: RolUsuario }
        Returns: boolean
      }
    }
    Enums: {
      rol_usuario: RolUsuario
      estado_registro: EstadoRegistro
      tipo_sesion: TipoSesion
      fase_pt: FasePT
      estado_actividad: EstadoActividad
      estado_asistencia: EstadoAsistencia
      estado_evidencia: EstadoEvidencia
      tipo_evaluacion: TipoEvaluacion
      estado_acreditacion: EstadoAcreditacion
    }
    CompositeTypes: Record<string, never>
  }
}
