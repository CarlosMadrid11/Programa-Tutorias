-- ============================================================
-- SGPT - Sistema de Gestión del Programa de Tutorías
-- Instituto Tecnológico de Culiacán (TecNM Campus Culiacán)
-- Supabase SQL Schema
-- ============================================================
-- INSTRUCCIONES: Ejecutar este script completo en el SQL Editor
-- de Supabase. Incluye tablas, enums, RLS, triggers y funciones.
-- ============================================================

-- ------------------------------------------------------------
-- 0. EXTENSIONES
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ------------------------------------------------------------
-- 1. TIPOS ENUM
-- ------------------------------------------------------------

-- Roles del sistema
CREATE TYPE rol_usuario AS ENUM (
  'coordinador_institucional',
  'coordinador_departamental',
  'jefe_departamento',
  'jefe_desarrollo_academico',
  'tutor',
  'tutorado',
  'director',
  'subdirector'
);

-- Estado general de registros
CREATE TYPE estado_registro AS ENUM (
  'activo',
  'inactivo',
  'baja'
);

-- Modalidad de sesión tutorial
CREATE TYPE tipo_sesion AS ENUM (
  'grupal',
  'individual',
  'virtual',
  'plenaria'
);

-- Fases del Programa de Tutorías
CREATE TYPE fase_pt AS ENUM (
  'diagnostico',
  'planeacion',
  'acompanamiento',
  'seguimiento',
  'evaluacion'
);

-- Estado de actividad
CREATE TYPE estado_actividad AS ENUM (
  'activa',
  'cerrada',
  'bloqueada'
);

-- Estado de asistencia
CREATE TYPE estado_asistencia AS ENUM (
  'presente',
  'ausente',
  'justificado'
);

-- Estado de evidencia
CREATE TYPE estado_evidencia AS ENUM (
  'pendiente',
  'entregada',
  'aceptada',
  'requiere_correccion',
  'rechazada'
);

-- Tipo de evaluación
CREATE TYPE tipo_evaluacion AS ENUM (
  'parcial_1',
  'parcial_2',
  'final'
);

-- Estado de acreditación del tutorado
CREATE TYPE estado_acreditacion AS ENUM (
  'al_corriente',
  'en_riesgo',
  'atencion_urgente',
  'acreditado',
  'no_acreditado'
);

-- ------------------------------------------------------------
-- 2. TABLA PERFILES (vinculada a auth.users)
-- Centro del sistema de identidad
-- ------------------------------------------------------------
CREATE TABLE public.perfiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol                   rol_usuario NOT NULL,
  nombre_completo       TEXT        NOT NULL,
  correo_institucional  TEXT        NOT NULL UNIQUE,
  numero_empleado       TEXT        UNIQUE,           -- Para tutores/personal
  numero_control        TEXT        UNIQUE,           -- Para tutorados
  telefono              TEXT,
  departamento          TEXT,
  carrera               TEXT,
  estado                estado_registro NOT NULL DEFAULT 'activo',
  primer_acceso         BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_por            UUID        REFERENCES auth.users(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints de integridad por rol
  CONSTRAINT chk_empleado_o_control CHECK (
    (rol = 'tutorado' AND numero_control IS NOT NULL)
    OR (rol != 'tutorado' AND numero_empleado IS NOT NULL)
  ),
  CONSTRAINT chk_correo_institucional CHECK (
    correo_institucional LIKE '%@culiacan.tecnm.mx'
    OR correo_institucional LIKE '%@itculiacan.edu.mx'
  )
);

-- Comentarios de columnas
COMMENT ON TABLE public.perfiles IS 'Perfiles de usuario vinculados a auth.users. Gestiona roles, datos personales y metadata.';
COMMENT ON COLUMN public.perfiles.primer_acceso IS 'Si TRUE, el usuario debe cambiar su contraseña temporal al ingresar.';
COMMENT ON COLUMN public.perfiles.creado_por IS 'El coordinador institucional que creó este perfil.';

-- ------------------------------------------------------------
-- 3. INSTITUCIÓN
-- ------------------------------------------------------------
CREATE TABLE public.it_culiacan (
  id              SERIAL      PRIMARY KEY,
  nombre          TEXT        NOT NULL DEFAULT 'Instituto Tecnológico de Culiacán',
  clave_tecnm     TEXT        NOT NULL DEFAULT 'TECNM-CULIACAN',
  direccion       TEXT,
  telefono        TEXT,
  correo_oficial  TEXT,
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo una institución
INSERT INTO public.it_culiacan (nombre, clave_tecnm, direccion)
VALUES (
  'Instituto Tecnológico de Culiacán',
  'TECNM-CULIACAN',
  'Juan de Dios Bátiz 310, Guadalupe, 80220 Culiacán Rosales, Sin.'
);

-- ------------------------------------------------------------
-- 4. PERIODOS ESCOLARES
-- ------------------------------------------------------------
CREATE TABLE public.periodos_escolares (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT        NOT NULL,          -- Ej: "Enero-Junio 2026"
  fecha_inicio    DATE        NOT NULL,
  fecha_fin       DATE        NOT NULL,
  activo          BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_fechas_periodo CHECK (fecha_fin > fecha_inicio),
  CONSTRAINT uq_periodo_nombre UNIQUE (nombre)
);

COMMENT ON TABLE public.periodos_escolares IS 'Solo puede existir un periodo activo a la vez (enforced por trigger).';

-- ------------------------------------------------------------
-- 5. PROGRAMA DE TUTORÍAS (por periodo)
-- ------------------------------------------------------------
CREATE TABLE public.programas_tutorias (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id      UUID        NOT NULL REFERENCES public.periodos_escolares(id),
  nombre          TEXT        NOT NULL,
  descripcion     TEXT,
  objetivo_general TEXT,
  fecha_inicio    DATE        NOT NULL,
  fecha_fin       DATE        NOT NULL,
  activo          BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_por      UUID        NOT NULL REFERENCES public.perfiles(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6. ACTIVIDADES DEL PT
-- Definidas por el Coordinador Institucional
-- ------------------------------------------------------------
CREATE TABLE public.actividades_pt (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id           UUID          NOT NULL REFERENCES public.programas_tutorias(id),
  nombre                TEXT          NOT NULL,
  descripcion           TEXT,
  tipo_sesion           tipo_sesion   NOT NULL,
  fase                  fase_pt       NOT NULL,
  fecha_programada      DATE          NOT NULL,
  requiere_evidencia    BOOLEAN       NOT NULL DEFAULT FALSE,
  tipo_archivo_aceptado TEXT[],       -- Ej: {'pdf','docx','jpg'}
  fecha_limite_evidencia DATE,
  estado                estado_actividad NOT NULL DEFAULT 'activa',
  bloqueada_modificacion BOOLEAN      NOT NULL DEFAULT FALSE,
  creado_por            UUID          NOT NULL REFERENCES public.perfiles(id),
  creado_en             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_evidencia_completa CHECK (
    NOT requiere_evidencia
    OR (requiere_evidencia AND tipo_archivo_aceptado IS NOT NULL AND fecha_limite_evidencia IS NOT NULL)
  )
);

-- ------------------------------------------------------------
-- 7. ASIGNACIONES DE TUTOR (grupo + horario)
-- Jefe de Departamento asigna tutor a grupo y horario
-- ------------------------------------------------------------
CREATE TABLE public.asignaciones_tutor (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id            UUID        NOT NULL REFERENCES public.periodos_escolares(id),
  tutor_id              UUID        NOT NULL REFERENCES public.perfiles(id),
  carrera               TEXT        NOT NULL,
  semestre_generacional TEXT        NOT NULL,   -- Ej: "ISC-2023A"
  grupo                 TEXT        NOT NULL,   -- Ej: "A", "B"
  dia_semana            TEXT        NOT NULL,   -- Ej: "Lunes"
  hora_inicio           TIME        NOT NULL,
  hora_fin              TIME        NOT NULL,
  salon                 TEXT        NOT NULL,
  activa                BOOLEAN     NOT NULL DEFAULT TRUE,
  asignado_por          UUID        NOT NULL REFERENCES public.perfiles(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_horario_valido CHECK (hora_fin > hora_inicio),
  CONSTRAINT uq_tutor_periodo_grupo UNIQUE (tutor_id, periodo_id, grupo, carrera)
);

-- Evitar conflictos de salón en mismo horario/día
CREATE UNIQUE INDEX idx_salon_horario_unico
  ON public.asignaciones_tutor (salon, dia_semana, hora_inicio, periodo_id)
  WHERE activa = TRUE;

-- ------------------------------------------------------------
-- 8. RELACIÓN TUTOR-TUTORADO
-- Coordinador Departamental asigna tutorados a tutores
-- ------------------------------------------------------------
CREATE TABLE public.asignaciones_tutorado (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id     UUID        NOT NULL REFERENCES public.asignaciones_tutor(id),
  tutorado_id       UUID        NOT NULL REFERENCES public.perfiles(id),
  periodo_id        UUID        NOT NULL REFERENCES public.periodos_escolares(id),
  fecha_asignacion  DATE        NOT NULL DEFAULT CURRENT_DATE,
  activa            BOOLEAN     NOT NULL DEFAULT TRUE,
  justificacion_reasignacion TEXT,
  asignado_por      UUID        NOT NULL REFERENCES public.perfiles(id),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un tutorado solo puede tener UN tutor por periodo
  CONSTRAINT uq_tutorado_periodo UNIQUE (tutorado_id, periodo_id)
);

-- ------------------------------------------------------------
-- 9. ACTIVIDADES ADAPTADAS POR TUTOR
-- El tutor puede adaptar una actividad del PT para su grupo
-- ------------------------------------------------------------
CREATE TABLE public.actividades_adaptadas (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_pt_id       UUID          NOT NULL REFERENCES public.actividades_pt(id),
  asignacion_id         UUID          NOT NULL REFERENCES public.asignaciones_tutor(id),
  descripcion_adaptada  TEXT,
  fecha_adaptada        DATE,
  tipo_archivo_adaptado TEXT[],
  justificacion         TEXT          NOT NULL,
  modificado_por        UUID          NOT NULL REFERENCES public.perfiles(id),
  creado_en             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_adaptacion_por_grupo UNIQUE (actividad_pt_id, asignacion_id)
);

-- ------------------------------------------------------------
-- 10. SESIONES DE TUTORÍA
-- Cada sesión concreta realizada por un tutor con su grupo
-- ------------------------------------------------------------
CREATE TABLE public.sesiones (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id     UUID          NOT NULL REFERENCES public.asignaciones_tutor(id),
  actividad_pt_id   UUID          REFERENCES public.actividades_pt(id),
  fecha_realizada   DATE          NOT NULL,
  aula              TEXT,
  descripcion       TEXT,
  es_extraordinaria BOOLEAN       NOT NULL DEFAULT FALSE,
  justificacion_ext TEXT,
  cerrada           BOOLEAN       NOT NULL DEFAULT FALSE,
  creado_por        UUID          NOT NULL REFERENCES public.perfiles(id),
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 11. ASISTENCIAS
-- ------------------------------------------------------------
CREATE TABLE public.asistencias (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id       UUID              NOT NULL REFERENCES public.sesiones(id),
  tutorado_id     UUID              NOT NULL REFERENCES public.perfiles(id),
  estado          estado_asistencia NOT NULL,
  observaciones   TEXT,
  fecha_captura   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  capturado_por   UUID              NOT NULL REFERENCES public.perfiles(id),

  CONSTRAINT uq_asistencia_sesion_tutorado UNIQUE (sesion_id, tutorado_id)
);

-- Vista materializable: porcentaje de asistencia por tutorado/periodo
-- (se calcula vía función, no tabla)

-- ------------------------------------------------------------
-- 12. EVIDENCIAS
-- ------------------------------------------------------------
CREATE TABLE public.evidencias (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad_pt_id   UUID              NOT NULL REFERENCES public.actividades_pt(id),
  tutorado_id       UUID              NOT NULL REFERENCES public.perfiles(id),
  periodo_id        UUID              NOT NULL REFERENCES public.periodos_escolares(id),
  archivo_url       TEXT,             -- URL en Supabase Storage
  archivo_nombre    TEXT,
  archivo_tipo      TEXT,
  archivo_tamano_kb INTEGER,
  comentario_alumno TEXT,
  estado            estado_evidencia  NOT NULL DEFAULT 'pendiente',
  retroalimentacion TEXT,
  evaluada_por      UUID              REFERENCES public.perfiles(id),
  fecha_entrega     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  fecha_evaluacion  TIMESTAMPTZ,
  version           INTEGER           NOT NULL DEFAULT 1,
  creado_en         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_tamano_archivo CHECK (archivo_tamano_kb IS NULL OR archivo_tamano_kb <= 10240),
  CONSTRAINT chk_retroalim_obligatoria CHECK (
    estado NOT IN ('requiere_correccion','rechazada')
    OR retroalimentacion IS NOT NULL
  )
);

-- Historial de versiones de evidencia
CREATE TABLE public.evidencias_historial (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidencia_id      UUID        NOT NULL REFERENCES public.evidencias(id),
  archivo_url       TEXT,
  archivo_nombre    TEXT,
  estado_anterior   estado_evidencia,
  version           INTEGER     NOT NULL,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 13. EVALUACIONES (parciales y final)
-- ------------------------------------------------------------
CREATE TABLE public.evaluaciones (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id           UUID              NOT NULL REFERENCES public.perfiles(id),
  asignacion_id         UUID              NOT NULL REFERENCES public.asignaciones_tutor(id),
  periodo_id            UUID              NOT NULL REFERENCES public.periodos_escolares(id),
  tipo                  tipo_evaluacion   NOT NULL,
  -- Escala 0-4 (4=Excelente, 3=Notable, 2=Suficiente, <2=Insuficiente)
  calificacion_personal NUMERIC(3,1)      CHECK (calificacion_personal BETWEEN 0 AND 4),
  calificacion_academica NUMERIC(3,1)     CHECK (calificacion_academica BETWEEN 0 AND 4),
  calificacion_profesional NUMERIC(3,1)  CHECK (calificacion_profesional BETWEEN 0 AND 4),
  calificacion_final    NUMERIC(3,1)      CHECK (calificacion_final BETWEEN 0 AND 4),
  observaciones         TEXT,
  recomendaciones       TEXT,
  estado_tutorado       estado_acreditacion,
  requiere_canalizacion BOOLEAN           NOT NULL DEFAULT FALSE,
  evaluado_por          UUID              NOT NULL REFERENCES public.perfiles(id),
  creado_en             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_evaluacion_tipo UNIQUE (tutorado_id, periodo_id, tipo)
);

-- ------------------------------------------------------------
-- 14. CANALIZACIONES
-- ------------------------------------------------------------
CREATE TABLE public.canalizaciones (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id         UUID        NOT NULL REFERENCES public.perfiles(id),
  evaluacion_id       UUID        REFERENCES public.evaluaciones(id),
  periodo_id          UUID        NOT NULL REFERENCES public.periodos_escolares(id),
  tipo_servicio       TEXT        NOT NULL,  -- Psicológico, Médico, Becas, etc.
  descripcion_motivo  TEXT        NOT NULL,
  fecha_canalizacion  DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_seguimiento   DATE,
  estado_seguimiento  TEXT,
  canalizado_por      UUID        NOT NULL REFERENCES public.perfiles(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 15. ACREDITACIONES
-- ------------------------------------------------------------
CREATE TABLE public.acreditaciones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorado_id       UUID        NOT NULL REFERENCES public.perfiles(id),
  periodo_id        UUID        NOT NULL REFERENCES public.periodos_escolares(id),
  asignacion_id     UUID        NOT NULL REFERENCES public.asignaciones_tutor(id),
  acreditado        BOOLEAN     NOT NULL,
  porcentaje_asistencia NUMERIC(5,2),
  calificacion_final NUMERIC(3,1),
  motivo_no_acreditacion TEXT,
  numero_folio      TEXT        UNIQUE,
  pdf_url           TEXT,
  generado_por      UUID        NOT NULL REFERENCES public.perfiles(id),
  fecha_generacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_acreditacion_tutorado_periodo UNIQUE (tutorado_id, periodo_id)
);

-- ------------------------------------------------------------
-- 16. LOG DE AUDITORÍA
-- Registro inmutable de cambios críticos
-- ------------------------------------------------------------
CREATE TABLE public.auditoria (
  id          BIGSERIAL   PRIMARY KEY,
  tabla       TEXT        NOT NULL,
  operacion   TEXT        NOT NULL,   -- INSERT, UPDATE, DELETE
  registro_id TEXT        NOT NULL,
  usuario_id  UUID        REFERENCES auth.users(id),
  datos_antes JSONB,
  datos_despues JSONB,
  ip_address  INET,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para auditoría
CREATE INDEX idx_auditoria_tabla ON public.auditoria(tabla);
CREATE INDEX idx_auditoria_usuario ON public.auditoria(usuario_id);
CREATE INDEX idx_auditoria_fecha ON public.auditoria(creado_en DESC);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- ------------------------------------------------------------
-- F1. Actualizar campo updated_at automáticamente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$;

-- Aplicar a tablas con actualizado_en
CREATE TRIGGER trg_perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_programas_updated_at
  BEFORE UPDATE ON public.programas_tutorias
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_actividades_updated_at
  BEFORE UPDATE ON public.actividades_pt
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_asignaciones_tutor_updated_at
  BEFORE UPDATE ON public.asignaciones_tutor
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_evaluaciones_updated_at
  BEFORE UPDATE ON public.evaluaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_canalizaciones_updated_at
  BEFORE UPDATE ON public.canalizaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ------------------------------------------------------------
-- F2. Crear perfil automáticamente al crear usuario en auth
-- (Solo crea el registro base; el rol se asigna después por
--  el coordinador mediante update)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_crear_perfil_nuevo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (
    id,
    rol,
    nombre_completo,
    correo_institucional,
    estado,
    primer_acceso
  )
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'tutorado'),
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Sin nombre'),
    NEW.email,
    'activo',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crear_perfil_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_crear_perfil_nuevo_usuario();

-- ------------------------------------------------------------
-- F3. Solo un periodo escolar activo a la vez
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_un_periodo_activo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.activo = TRUE THEN
    UPDATE public.periodos_escolares
    SET activo = FALSE
    WHERE id != NEW.id AND activo = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_un_periodo_activo
  BEFORE INSERT OR UPDATE ON public.periodos_escolares
  FOR EACH ROW EXECUTE FUNCTION public.fn_un_periodo_activo();

-- ------------------------------------------------------------
-- F4. Auditoría automática en tablas críticas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario UUID;
BEGIN
  -- Intentar obtener el usuario actual
  BEGIN
    v_usuario := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_usuario := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.auditoria (tabla, operacion, registro_id, usuario_id, datos_antes)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id::TEXT, v_usuario, row_to_json(OLD)::JSONB);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.auditoria (tabla, operacion, registro_id, usuario_id, datos_antes, datos_despues)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id::TEXT, v_usuario, row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.auditoria (tabla, operacion, registro_id, usuario_id, datos_despues)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id::TEXT, v_usuario, row_to_json(NEW)::JSONB);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Triggers de auditoría en tablas críticas
CREATE TRIGGER trg_auditoria_perfiles
  AFTER INSERT OR UPDATE OR DELETE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_auditoria_asignaciones_tutor
  AFTER INSERT OR UPDATE OR DELETE ON public.asignaciones_tutor
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_auditoria_asignaciones_tutorado
  AFTER INSERT OR UPDATE OR DELETE ON public.asignaciones_tutorado
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

CREATE TRIGGER trg_auditoria_acreditaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.acreditaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria();

-- ------------------------------------------------------------
-- F5. Alerta automática por inasistencias críticas (>30%)
-- Inserta en tabla de alertas cuando un tutorado supera umbral
-- ------------------------------------------------------------
CREATE TABLE public.alertas_sistema (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        TEXT        NOT NULL,
  tutorado_id UUID        NOT NULL REFERENCES public.perfiles(id),
  tutor_id    UUID        REFERENCES public.perfiles(id),
  mensaje     TEXT        NOT NULL,
  resuelta    BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.fn_verificar_inasistencias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sesiones    INTEGER;
  v_total_ausencias   INTEGER;
  v_porcentaje        NUMERIC;
  v_asignacion_id     UUID;
  v_tutor_id          UUID;
BEGIN
  -- Solo actúa en ausencias
  IF NEW.estado != 'ausente' THEN
    RETURN NEW;
  END IF;

  -- Obtener asignación del tutorado en esta sesión
  SELECT s.asignacion_id INTO v_asignacion_id
  FROM public.sesiones s
  WHERE s.id = NEW.sesion_id;

  -- Total sesiones realizadas para este tutorado en su asignación
  SELECT COUNT(*) INTO v_total_sesiones
  FROM public.asistencias a
  JOIN public.sesiones s ON s.id = a.sesion_id
  WHERE a.tutorado_id = NEW.tutorado_id
    AND s.asignacion_id = v_asignacion_id;

  -- Total ausencias no justificadas
  SELECT COUNT(*) INTO v_total_ausencias
  FROM public.asistencias a
  JOIN public.sesiones s ON s.id = a.sesion_id
  WHERE a.tutorado_id = NEW.tutorado_id
    AND s.asignacion_id = v_asignacion_id
    AND a.estado = 'ausente';

  -- Calcular porcentaje de ausencias
  IF v_total_sesiones > 0 THEN
    v_porcentaje := (v_total_ausencias::NUMERIC / v_total_sesiones) * 100;
  ELSE
    RETURN NEW;
  END IF;

  -- Si supera 20% de ausencias, crear alerta
  IF v_porcentaje > 20 THEN
    -- Obtener tutor
    SELECT tutor_id INTO v_tutor_id
    FROM public.asignaciones_tutor
    WHERE id = v_asignacion_id;

    -- Insertar alerta (ignorar si ya existe una activa del mismo tipo)
    INSERT INTO public.alertas_sistema (tipo, tutorado_id, tutor_id, mensaje)
    SELECT
      'inasistencia_critica',
      NEW.tutorado_id,
      v_tutor_id,
      'El tutorado ha acumulado ' || ROUND(v_porcentaje, 1) || '% de inasistencias'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.alertas_sistema
      WHERE tipo = 'inasistencia_critica'
        AND tutorado_id = NEW.tutorado_id
        AND resuelta = FALSE
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verificar_inasistencias
  AFTER INSERT ON public.asistencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_verificar_inasistencias();

-- ------------------------------------------------------------
-- F6. Versionar evidencias al actualizarse
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_versionar_evidencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si cambia el archivo, guardar versión anterior
  IF OLD.archivo_url IS DISTINCT FROM NEW.archivo_url THEN
    INSERT INTO public.evidencias_historial (
      evidencia_id, archivo_url, archivo_nombre, estado_anterior, version
    ) VALUES (
      OLD.id, OLD.archivo_url, OLD.archivo_nombre, OLD.estado, OLD.version
    );
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_versionar_evidencia
  BEFORE UPDATE ON public.evidencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_versionar_evidencia();

-- ------------------------------------------------------------
-- F7. Función helper: obtener rol del usuario actual
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_get_rol_usuario()
RETURNS rol_usuario
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_rol rol_usuario;
BEGIN
  SELECT rol INTO v_rol
  FROM public.perfiles
  WHERE id = auth.uid();
  RETURN v_rol;
END;
$$;

-- ------------------------------------------------------------
-- F8. Función helper: verificar si usuario tiene rol específico
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_tiene_rol(p_rol rol_usuario)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = p_rol AND estado = 'activo'
  );
END;
$$;

-- Variante para múltiples roles
CREATE OR REPLACE FUNCTION public.fn_tiene_alguno_de_los_roles(p_roles rol_usuario[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid()
      AND rol = ANY(p_roles)
      AND estado = 'activo'
  );
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_escolares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas_tutorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades_pt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_tutorado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividades_adaptadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canalizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acreditaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_culiacan ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- ---- PERFILES ----

-- Cualquier usuario autenticado puede ver su propio perfil
CREATE POLICY "perfiles_ver_propio"
  ON public.perfiles FOR SELECT
  USING (id = auth.uid());

-- Coordinadores y jefes pueden ver todos los perfiles
CREATE POLICY "perfiles_ver_coordinadores"
  ON public.perfiles FOR SELECT
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario,
      'director'::rol_usuario,
      'subdirector'::rol_usuario
    ]::rol_usuario[])
  );

-- Tutores pueden ver los perfiles de sus tutorados
CREATE POLICY "perfiles_tutor_ver_tutorados"
  ON public.perfiles FOR SELECT
  USING (
    fn_tiene_rol('tutor'::rol_usuario)
    AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado at2
      JOIN public.asignaciones_tutor at1 ON at1.id = at2.asignacion_id
      WHERE at2.tutorado_id = perfiles.id
        AND at1.tutor_id = auth.uid()
        AND at2.activa = TRUE
    )
  );

-- Solo coordinador institucional puede insertar perfiles
CREATE POLICY "perfiles_insertar_coordinador"
  ON public.perfiles FOR INSERT
  WITH CHECK (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- Solo coordinador institucional puede actualizar perfiles ajenos
-- Cualquier usuario puede actualizar su propio perfil (datos básicos)
CREATE POLICY "perfiles_actualizar_propio"
  ON public.perfiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- No puede cambiar su propio rol
    AND rol = (SELECT rol FROM public.perfiles WHERE id = auth.uid())
  );

CREATE POLICY "perfiles_actualizar_coordinador"
  ON public.perfiles FOR UPDATE
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- Nadie puede eliminar perfiles desde la app (solo desde Postgres)
-- (No se crea política DELETE, por lo que está bloqueado)

-- ---- PERIODOS ESCOLARES ----

CREATE POLICY "periodos_ver_autenticados"
  ON public.periodos_escolares FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "periodos_gestionar_coordinador"
  ON public.periodos_escolares FOR ALL
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- PROGRAMAS DE TUTORÍAS ----

CREATE POLICY "programas_ver_autenticados"
  ON public.programas_tutorias FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "programas_gestionar_coordinador"
  ON public.programas_tutorias FOR ALL
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- ACTIVIDADES PT ----

CREATE POLICY "actividades_ver_autenticados"
  ON public.actividades_pt FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "actividades_gestionar_coordinador"
  ON public.actividades_pt FOR INSERT
  WITH CHECK (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "actividades_actualizar_coordinador"
  ON public.actividades_pt FOR UPDATE
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- ASIGNACIONES TUTOR ----

CREATE POLICY "asig_tutor_ver_involucrados"
  ON public.asignaciones_tutor FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario,
      'director'::rol_usuario,
      'subdirector'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "asig_tutor_gestionar_jefe"
  ON public.asignaciones_tutor FOR ALL
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'jefe_departamento'::rol_usuario,
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- ASIGNACIONES TUTORADO ----

CREATE POLICY "asig_tutorado_ver_involucrados"
  ON public.asignaciones_tutorado FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at1
      WHERE at1.id = asignaciones_tutorado.asignacion_id
        AND at1.tutor_id = auth.uid()
    )
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "asig_tutorado_gestionar_coord_dept"
  ON public.asignaciones_tutorado FOR ALL
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_departamental'::rol_usuario,
      'coordinador_institucional'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- SESIONES ----

CREATE POLICY "sesiones_ver_involucrados"
  ON public.sesiones FOR SELECT
  USING (
    creado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado at2
      JOIN public.asignaciones_tutor at1 ON at1.id = at2.asignacion_id
      WHERE at1.id = sesiones.asignacion_id
        AND (at1.tutor_id = auth.uid() OR at2.tutorado_id = auth.uid())
    )
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "sesiones_gestionar_tutor"
  ON public.sesiones FOR ALL
  USING (
    fn_tiene_rol('tutor'::rol_usuario)
    AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at1
      WHERE at1.id = sesiones.asignacion_id
        AND at1.tutor_id = auth.uid()
    )
  );

-- ---- ASISTENCIAS ----

CREATE POLICY "asistencias_ver_involucrados"
  ON public.asistencias FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR capturado_por = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "asistencias_gestionar_tutor"
  ON public.asistencias FOR ALL
  USING (
    fn_tiene_rol('tutor'::rol_usuario)
    AND EXISTS (
      SELECT 1
      FROM public.sesiones s
      JOIN public.asignaciones_tutor at1 ON at1.id = s.asignacion_id
      WHERE s.id = asistencias.sesion_id
        AND at1.tutor_id = auth.uid()
    )
  );

-- ---- EVIDENCIAS ----

CREATE POLICY "evidencias_ver_involucrados"
  ON public.evidencias FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR evaluada_por = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario,
      'tutor'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "evidencias_insertar_tutorado"
  ON public.evidencias FOR INSERT
  WITH CHECK (
    fn_tiene_rol('tutorado'::rol_usuario)
    AND tutorado_id = auth.uid()
  );

CREATE POLICY "evidencias_actualizar_tutorado_propio"
  ON public.evidencias FOR UPDATE
  USING (
    tutorado_id = auth.uid()
    AND fn_tiene_rol('tutorado'::rol_usuario)
    AND estado IN ('pendiente', 'requiere_correccion')
  );

CREATE POLICY "evidencias_evaluar_tutor"
  ON public.evidencias FOR UPDATE
  USING (
    fn_tiene_rol('tutor'::rol_usuario)
    AND EXISTS (
      SELECT 1
      FROM public.asignaciones_tutorado at2
      JOIN public.asignaciones_tutor at1 ON at1.id = at2.asignacion_id
      WHERE at2.tutorado_id = evidencias.tutorado_id
        AND at1.tutor_id = auth.uid()
    )
  );

-- ---- EVALUACIONES ----

CREATE POLICY "evaluaciones_ver_involucrados"
  ON public.evaluaciones FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR evaluado_por = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "evaluaciones_gestionar_tutor"
  ON public.evaluaciones FOR ALL
  USING (
    fn_tiene_rol('tutor'::rol_usuario)
    AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at1
      WHERE at1.id = evaluaciones.asignacion_id
        AND at1.tutor_id = auth.uid()
    )
  );

-- ---- CANALIZACIONES ----

CREATE POLICY "canalizaciones_ver_involucrados"
  ON public.canalizaciones FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR canalizado_por = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "canalizaciones_gestionar_tutor"
  ON public.canalizaciones FOR ALL
  USING (
    fn_tiene_rol('tutor'::rol_usuario)
    AND canalizado_por = auth.uid()
  );

-- ---- ACREDITACIONES ----

CREATE POLICY "acreditaciones_ver_involucrados"
  ON public.acreditaciones FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR generado_por = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario
    ]::rol_usuario[])
  );

CREATE POLICY "acreditaciones_gestionar_tutor_coord"
  ON public.acreditaciones FOR ALL
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'tutor'::rol_usuario,
      'jefe_departamento'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'coordinador_institucional'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- ALERTAS ----

CREATE POLICY "alertas_ver_tutor_coord"
  ON public.alertas_sistema FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'coordinador_departamental'::rol_usuario,
      'jefe_departamento'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- AUDITORÍA (solo lectura para coordinador) ----

CREATE POLICY "auditoria_solo_coordinador"
  ON public.auditoria FOR SELECT
  USING (
    fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional'::rol_usuario,
      'jefe_desarrollo_academico'::rol_usuario
    ]::rol_usuario[])
  );

-- ---- IT CULIACAN ----

CREATE POLICY "it_culiacan_ver_todos"
  ON public.it_culiacan FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- ÍNDICES DE RENDIMIENTO
-- ============================================================

CREATE INDEX idx_perfiles_rol ON public.perfiles(rol);
CREATE INDEX idx_perfiles_carrera ON public.perfiles(carrera);
CREATE INDEX idx_perfiles_estado ON public.perfiles(estado);

CREATE INDEX idx_asig_tutor_periodo ON public.asignaciones_tutor(periodo_id);
CREATE INDEX idx_asig_tutor_tutor ON public.asignaciones_tutor(tutor_id);
CREATE INDEX idx_asig_tutor_carrera ON public.asignaciones_tutor(carrera);

CREATE INDEX idx_asig_tutorado_tutorado ON public.asignaciones_tutorado(tutorado_id);
CREATE INDEX idx_asig_tutorado_periodo ON public.asignaciones_tutorado(periodo_id);

CREATE INDEX idx_sesiones_asignacion ON public.sesiones(asignacion_id);
CREATE INDEX idx_sesiones_fecha ON public.sesiones(fecha_realizada);

CREATE INDEX idx_asistencias_tutorado ON public.asistencias(tutorado_id);
CREATE INDEX idx_asistencias_sesion ON public.asistencias(sesion_id);

CREATE INDEX idx_evidencias_tutorado ON public.evidencias(tutorado_id);
CREATE INDEX idx_evidencias_actividad ON public.evidencias(actividad_pt_id);
CREATE INDEX idx_evidencias_estado ON public.evidencias(estado);

CREATE INDEX idx_evaluaciones_tutorado ON public.evaluaciones(tutorado_id);
CREATE INDEX idx_evaluaciones_periodo ON public.evaluaciones(periodo_id);

CREATE INDEX idx_alertas_tutorado ON public.alertas_sistema(tutorado_id);
CREATE INDEX idx_alertas_no_resueltas ON public.alertas_sistema(resuelta) WHERE resuelta = FALSE;

-- ============================================================
-- VISTAS ÚTILES (solo lectura)
-- ============================================================

-- Vista: resumen de tutorado con porcentaje de asistencia
CREATE OR REPLACE VIEW public.v_resumen_tutorado AS
SELECT
  p.id AS tutorado_id,
  p.nombre_completo,
  p.numero_control,
  p.carrera,
  at2.periodo_id,
  at1.tutor_id,
  pt.nombre_completo AS nombre_tutor,
  COUNT(DISTINCT s.id) AS total_sesiones,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'presente') AS sesiones_presentes,
  COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'ausente') AS sesiones_ausente,
  CASE
    WHEN COUNT(DISTINCT s.id) > 0
    THEN ROUND((COUNT(DISTINCT a.id) FILTER (WHERE a.estado = 'presente')::NUMERIC
         / COUNT(DISTINCT s.id)) * 100, 2)
    ELSE 0
  END AS porcentaje_asistencia,
  COUNT(DISTINCT ev.id) FILTER (WHERE ev.estado = 'pendiente') AS evidencias_pendientes,
  COUNT(DISTINCT ev.id) FILTER (WHERE ev.estado = 'aceptada') AS evidencias_aceptadas
FROM public.perfiles p
JOIN public.asignaciones_tutorado at2 ON at2.tutorado_id = p.id AND at2.activa = TRUE
JOIN public.asignaciones_tutor at1 ON at1.id = at2.asignacion_id
JOIN public.perfiles pt ON pt.id = at1.tutor_id
LEFT JOIN public.sesiones s ON s.asignacion_id = at1.id
LEFT JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = p.id
LEFT JOIN public.evidencias ev ON ev.tutorado_id = p.id AND ev.periodo_id = at2.periodo_id
WHERE p.rol = 'tutorado'
GROUP BY p.id, p.nombre_completo, p.numero_control, p.carrera,
         at2.periodo_id, at1.tutor_id, pt.nombre_completo;

-- Vista: tutores por carrera con detalle operativo
CREATE OR REPLACE VIEW public.v_tutores_por_carrera AS
SELECT
  at1.carrera,
  at1.periodo_id,
  pe.nombre AS periodo_nombre,
  COUNT(DISTINCT at1.tutor_id) AS total_tutores,
  COUNT(DISTINCT at2.tutorado_id) AS total_tutorados,
  COUNT(DISTINCT at1.id) AS total_grupos,
  ROUND(COUNT(DISTINCT at2.tutorado_id)::NUMERIC /
    NULLIF(COUNT(DISTINCT at1.tutor_id), 0), 1) AS promedio_tutorados_por_tutor
FROM public.asignaciones_tutor at1
JOIN public.periodos_escolares pe ON pe.id = at1.periodo_id
LEFT JOIN public.asignaciones_tutorado at2 ON at2.asignacion_id = at1.id AND at2.activa = TRUE
WHERE at1.activa = TRUE
GROUP BY at1.carrera, at1.periodo_id, pe.nombre;

-- ============================================================
-- DATOS SEMILLA (seed) para desarrollo
-- ============================================================

-- Periodo escolar inicial
INSERT INTO public.periodos_escolares (nombre, fecha_inicio, fecha_fin, activo)
VALUES ('Enero-Junio 2026', '2026-01-13', '2026-06-27', TRUE);

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
-- NOTAS IMPORTANTES:
-- 1. Las contraseñas de usuarios se crean desde Supabase Auth (Dashboard o Admin API)
-- 2. Las modificaciones directas a perfiles deben hacerse por un coordinador
--    institucional o desde Postgres/funciones privilegiadas
-- 3. Supabase Storage necesita configurarse separadamente para evidencias
-- 4. El bucket de storage debe llamarse "evidencias" con políticas similares a RLS
-- ============================================================