export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actividad_planificada: {
        Row: {
          descripcion: string | null
          fase_pt: string | null
          fecha_limite_entrega: string | null
          fecha_programada: string
          id_actividad: string
          id_programa: string | null
          justificacion_modificacion: string | null
          nombre_actividad: string
          requiere_evidencia: boolean | null
          tipo_evidencia_esperada: string | null
          tipo_sesion: string | null
        }
        Insert: {
          descripcion?: string | null
          fase_pt?: string | null
          fecha_limite_entrega?: string | null
          fecha_programada: string
          id_actividad?: string
          id_programa?: string | null
          justificacion_modificacion?: string | null
          nombre_actividad: string
          requiere_evidencia?: boolean | null
          tipo_evidencia_esperada?: string | null
          tipo_sesion?: string | null
        }
        Update: {
          descripcion?: string | null
          fase_pt?: string | null
          fecha_limite_entrega?: string | null
          fecha_programada?: string
          id_actividad?: string
          id_programa?: string | null
          justificacion_modificacion?: string | null
          nombre_actividad?: string
          requiere_evidencia?: boolean | null
          tipo_evidencia_esperada?: string | null
          tipo_sesion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividad_planificada_id_programa_fkey"
            columns: ["id_programa"]
            isOneToOne: false
            referencedRelation: "programa_tutorias"
            referencedColumns: ["id_programa"]
          },
        ]
      }
      asignacion_tutor: {
        Row: {
          cupo_maximo: number | null
          grupo_seccion: string
          hora_fin: string | null
          hora_inicio: string | null
          horario_dia: string | null
          id_asignacion: string
          id_coordinador_dept: string | null
          id_programa: string | null
          id_tutor: string | null
          salon: string | null
        }
        Insert: {
          cupo_maximo?: number | null
          grupo_seccion: string
          hora_fin?: string | null
          hora_inicio?: string | null
          horario_dia?: string | null
          id_asignacion?: string
          id_coordinador_dept?: string | null
          id_programa?: string | null
          id_tutor?: string | null
          salon?: string | null
        }
        Update: {
          cupo_maximo?: number | null
          grupo_seccion?: string
          hora_fin?: string | null
          hora_inicio?: string | null
          horario_dia?: string | null
          id_asignacion?: string
          id_coordinador_dept?: string | null
          id_programa?: string | null
          id_tutor?: string | null
          salon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asignacion_tutor_id_coordinador_dept_fkey"
            columns: ["id_coordinador_dept"]
            isOneToOne: false
            referencedRelation: "coordinador_departamental"
            referencedColumns: ["id_sistema"]
          },
          {
            foreignKeyName: "asignacion_tutor_id_programa_fkey"
            columns: ["id_programa"]
            isOneToOne: false
            referencedRelation: "programa_tutorias"
            referencedColumns: ["id_programa"]
          },
          {
            foreignKeyName: "asignacion_tutor_id_tutor_fkey"
            columns: ["id_tutor"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      asistencia: {
        Row: {
          estatus: string | null
          fecha_captura: string | null
          id_asistencia: string
          id_sesion: string | null
          id_tutorado: string | null
        }
        Insert: {
          estatus?: string | null
          fecha_captura?: string | null
          id_asistencia?: string
          id_sesion?: string | null
          id_tutorado?: string | null
        }
        Update: {
          estatus?: string | null
          fecha_captura?: string | null
          id_asistencia?: string
          id_sesion?: string | null
          id_tutorado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencia_id_sesion_fkey"
            columns: ["id_sesion"]
            isOneToOne: false
            referencedRelation: "sesion"
            referencedColumns: ["id_sesion"]
          },
          {
            foreignKeyName: "asistencia_id_tutorado_fkey"
            columns: ["id_tutorado"]
            isOneToOne: false
            referencedRelation: "tutorado"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      coordinador_departamental: {
        Row: {
          gestiona_grupos: boolean | null
          id_sistema: string
        }
        Insert: {
          gestiona_grupos?: boolean | null
          id_sistema: string
        }
        Update: {
          gestiona_grupos?: boolean | null
          id_sistema?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinador_departamental_id_sistema_fkey"
            columns: ["id_sistema"]
            isOneToOne: true
            referencedRelation: "sistema"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      coordinador_institucional: {
        Row: {
          id_sistema: string
        }
        Insert: {
          id_sistema: string
        }
        Update: {
          id_sistema?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinador_institucional_id_sistema_fkey"
            columns: ["id_sistema"]
            isOneToOne: true
            referencedRelation: "sistema"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      evaluacion_desempeno: {
        Row: {
          estatus_riesgo: string | null
          fecha_registro: string | null
          id_evaluacion: string
          id_tutor: string | null
          id_tutorado: string | null
          nivel_desempeno: number | null
          periodo_parcial: string | null
          plan_accion_seguimiento: string | null
          requiere_canalizacion: boolean | null
        }
        Insert: {
          estatus_riesgo?: string | null
          fecha_registro?: string | null
          id_evaluacion?: string
          id_tutor?: string | null
          id_tutorado?: string | null
          nivel_desempeno?: number | null
          periodo_parcial?: string | null
          plan_accion_seguimiento?: string | null
          requiere_canalizacion?: boolean | null
        }
        Update: {
          estatus_riesgo?: string | null
          fecha_registro?: string | null
          id_evaluacion?: string
          id_tutor?: string | null
          id_tutorado?: string | null
          nivel_desempeno?: number | null
          periodo_parcial?: string | null
          plan_accion_seguimiento?: string | null
          requiere_canalizacion?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluacion_desempeno_id_tutor_fkey"
            columns: ["id_tutor"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id_sistema"]
          },
          {
            foreignKeyName: "evaluacion_desempeno_id_tutorado_fkey"
            columns: ["id_tutorado"]
            isOneToOne: false
            referencedRelation: "tutorado"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      evidencia: {
        Row: {
          calificacion: number | null
          comentario_tutorado: string | null
          estatus_evaluacion: string | null
          fecha_entrega: string | null
          id_actividad: string | null
          id_evidencia: string
          id_tutor: string | null
          id_tutorado: string | null
          retroalimentacion: string | null
          url_archivo: string
        }
        Insert: {
          calificacion?: number | null
          comentario_tutorado?: string | null
          estatus_evaluacion?: string | null
          fecha_entrega?: string | null
          id_actividad?: string | null
          id_evidencia?: string
          id_tutor?: string | null
          id_tutorado?: string | null
          retroalimentacion?: string | null
          url_archivo: string
        }
        Update: {
          calificacion?: number | null
          comentario_tutorado?: string | null
          estatus_evaluacion?: string | null
          fecha_entrega?: string | null
          id_actividad?: string | null
          id_evidencia?: string
          id_tutor?: string | null
          id_tutorado?: string | null
          retroalimentacion?: string | null
          url_archivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidencia_id_actividad_fkey"
            columns: ["id_actividad"]
            isOneToOne: false
            referencedRelation: "actividad_planificada"
            referencedColumns: ["id_actividad"]
          },
          {
            foreignKeyName: "evidencia_id_tutor_fkey"
            columns: ["id_tutor"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id_sistema"]
          },
          {
            foreignKeyName: "evidencia_id_tutorado_fkey"
            columns: ["id_tutorado"]
            isOneToOne: false
            referencedRelation: "tutorado"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      itculiacan: {
        Row: {
          direccion: string | null
          id_institucional: string | null
          id_tec: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          direccion?: string | null
          id_institucional?: string | null
          id_tec?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          direccion?: string | null
          id_institucional?: string | null
          id_tec?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itculiacan_id_institucional_fkey"
            columns: ["id_institucional"]
            isOneToOne: false
            referencedRelation: "tecnm"
            referencedColumns: ["id_institucional"]
          },
        ]
      }
      jefe_departamento_academico: {
        Row: {
          consulta_autorizada: boolean | null
          id_sistema: string
        }
        Insert: {
          consulta_autorizada?: boolean | null
          id_sistema: string
        }
        Update: {
          consulta_autorizada?: boolean | null
          id_sistema?: string
        }
        Relationships: [
          {
            foreignKeyName: "jefe_departamento_academico_id_sistema_fkey"
            columns: ["id_sistema"]
            isOneToOne: true
            referencedRelation: "sistema"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      programa_tutorias: {
        Row: {
          descripcion: string | null
          estado_periodo: string | null
          fecha_fin: string
          fecha_inicio: string
          id_programa: string
          id_tec: string | null
          semestre_periodo: string
        }
        Insert: {
          descripcion?: string | null
          estado_periodo?: string | null
          fecha_fin: string
          fecha_inicio: string
          id_programa?: string
          id_tec?: string | null
          semestre_periodo: string
        }
        Update: {
          descripcion?: string | null
          estado_periodo?: string | null
          fecha_fin?: string
          fecha_inicio?: string
          id_programa?: string
          id_tec?: string | null
          semestre_periodo?: string
        }
        Relationships: [
          {
            foreignKeyName: "programa_tutorias_id_tec_fkey"
            columns: ["id_tec"]
            isOneToOne: false
            referencedRelation: "itculiacan"
            referencedColumns: ["id_tec"]
          },
        ]
      }
      sesion: {
        Row: {
          aula: string | null
          comentarios: string | null
          fecha_realizacion: string | null
          id_actividad: string | null
          id_sesion: string
          id_tutor: string | null
        }
        Insert: {
          aula?: string | null
          comentarios?: string | null
          fecha_realizacion?: string | null
          id_actividad?: string | null
          id_sesion?: string
          id_tutor?: string | null
        }
        Update: {
          aula?: string | null
          comentarios?: string | null
          fecha_realizacion?: string | null
          id_actividad?: string | null
          id_sesion?: string
          id_tutor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sesion_id_actividad_fkey"
            columns: ["id_actividad"]
            isOneToOne: false
            referencedRelation: "actividad_planificada"
            referencedColumns: ["id_actividad"]
          },
          {
            foreignKeyName: "sesion_id_tutor_fkey"
            columns: ["id_tutor"]
            isOneToOne: false
            referencedRelation: "tutor"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      sistema: {
        Row: {
          activo: boolean | null
          contrasena: string
          correo_institucional: string
          departamento_carrera: string | null
          id_sistema: string
          matricula_empleado: string
          nombre: string
          rol: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          contrasena: string
          correo_institucional: string
          departamento_carrera?: string | null
          id_sistema?: string
          matricula_empleado: string
          nombre: string
          rol: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          contrasena?: string
          correo_institucional?: string
          departamento_carrera?: string | null
          id_sistema?: string
          matricula_empleado?: string
          nombre?: string
          rol?: string
          telefono?: string | null
        }
        Relationships: []
      }
      tecnm: {
        Row: {
          id_institucional: string
          nombre_institucion: string | null
        }
        Insert: {
          id_institucional?: string
          nombre_institucion?: string | null
        }
        Update: {
          id_institucional?: string
          nombre_institucion?: string | null
        }
        Relationships: []
      }
      tutor: {
        Row: {
          cedula_profesional: string | null
          departamento_academico: string | null
          id_sistema: string
        }
        Insert: {
          cedula_profesional?: string | null
          departamento_academico?: string | null
          id_sistema: string
        }
        Update: {
          cedula_profesional?: string | null
          departamento_academico?: string | null
          id_sistema?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_id_sistema_fkey"
            columns: ["id_sistema"]
            isOneToOne: true
            referencedRelation: "sistema"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      tutorado: {
        Row: {
          carrera: string
          id_sistema: string
          no_control: string
        }
        Insert: {
          carrera: string
          id_sistema: string
          no_control: string
        }
        Update: {
          carrera?: string
          id_sistema?: string
          no_control?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorado_id_sistema_fkey"
            columns: ["id_sistema"]
            isOneToOne: true
            referencedRelation: "sistema"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
      tutorado_asignado: {
        Row: {
          fecha_vinculacion: string | null
          id_asignacion_tutor: string
          id_tutorado: string
        }
        Insert: {
          fecha_vinculacion?: string | null
          id_asignacion_tutor: string
          id_tutorado: string
        }
        Update: {
          fecha_vinculacion?: string | null
          id_asignacion_tutor?: string
          id_tutorado?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorado_asignado_id_asignacion_tutor_fkey"
            columns: ["id_asignacion_tutor"]
            isOneToOne: false
            referencedRelation: "asignacion_tutor"
            referencedColumns: ["id_asignacion"]
          },
          {
            foreignKeyName: "tutorado_asignado_id_tutorado_fkey"
            columns: ["id_tutorado"]
            isOneToOne: false
            referencedRelation: "tutorado"
            referencedColumns: ["id_sistema"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
