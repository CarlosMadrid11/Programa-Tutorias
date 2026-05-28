-- ============================================================
-- SGPT — Grupos tutoriales (máx. 25 tutorados), fechas por grupo
-- Ejecutar después de contexto.sql y sgpt_gestion_rpc.sql
-- ============================================================

ALTER TABLE public.asignaciones_tutor
  ADD COLUMN IF NOT EXISTS cupo_maximo INTEGER NOT NULL DEFAULT 25;

ALTER TABLE public.asignaciones_tutor
  DROP CONSTRAINT IF EXISTS chk_cupo_maximo_tutor;

ALTER TABLE public.asignaciones_tutor
  ADD CONSTRAINT chk_cupo_maximo_tutor
  CHECK (cupo_maximo > 0 AND cupo_maximo <= 25);

COMMENT ON COLUMN public.asignaciones_tutor.cupo_maximo IS
  'Máximo de tutorados por grupo tutorial (límite institucional: 25).';

CREATE TABLE IF NOT EXISTS public.actividades_grupo (
  actividad_pt_id           UUID NOT NULL REFERENCES public.actividades_pt(id) ON DELETE CASCADE,
  asignacion_id             UUID NOT NULL REFERENCES public.asignaciones_tutor(id) ON DELETE CASCADE,
  fecha_limite_evidencia    DATE,
  fecha_programada_grupo    DATE,
  actualizado_por           UUID NOT NULL REFERENCES public.perfiles(id),
  actualizado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actividad_pt_id, asignacion_id)
);

COMMENT ON TABLE public.actividades_grupo IS
  'Ajustes de fechas por grupo; no modifica la actividad oficial del PT para otros tutores.';

CREATE OR REPLACE FUNCTION public.fn_conteo_tutorados_grupo(p_asignacion_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.asignaciones_tutorado
  WHERE asignacion_id = p_asignacion_id AND activa = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.fn_validar_cupo_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupo INTEGER;
  v_actual INTEGER;
BEGIN
  SELECT cupo_maximo INTO v_cupo
  FROM public.asignaciones_tutor
  WHERE id = NEW.asignacion_id;

  IF v_cupo IS NULL THEN
    RAISE EXCEPTION 'Asignación de tutor no encontrada.';
  END IF;

  SELECT public.fn_conteo_tutorados_grupo(NEW.asignacion_id) INTO v_actual;

  IF TG_OP = 'INSERT' AND v_actual >= v_cupo THEN
    RAISE EXCEPTION 'El grupo alcanzó el cupo máximo de % tutorados.', v_cupo;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_cupo_grupo ON public.asignaciones_tutorado;
CREATE TRIGGER trg_validar_cupo_grupo
  BEFORE INSERT ON public.asignaciones_tutorado
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_cupo_grupo();

CREATE OR REPLACE FUNCTION public.fn_fecha_limite_grupo(
  p_actividad_pt_id UUID,
  p_asignacion_id   UUID
)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ag.fecha_limite_evidencia,
    ap.fecha_limite_evidencia
  )
  FROM public.actividades_pt ap
  LEFT JOIN public.actividades_grupo ag
    ON ag.actividad_pt_id = ap.id AND ag.asignacion_id = p_asignacion_id
  WHERE ap.id = p_actividad_pt_id;
$$;

CREATE OR REPLACE VIEW public.v_tutorado_mi_tutor AS
SELECT
  att.tutorado_id,
  att.periodo_id,
  p.nombre_completo AS tutor_nombre,
  p.correo_institucional AS tutor_correo,
  at2.carrera,
  at2.grupo,
  at2.semestre_generacional,
  at2.dia_semana,
  at2.hora_inicio,
  at2.hora_fin,
  at2.salon,
  pe.nombre AS periodo_nombre,
  att.activa AS asignacion_activa
FROM public.asignaciones_tutorado att
JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
JOIN public.perfiles p ON p.id = at2.tutor_id
JOIN public.periodos_escolares pe ON pe.id = att.periodo_id
WHERE att.activa = TRUE AND at2.activa = TRUE;

GRANT SELECT ON public.v_tutorado_mi_tutor TO authenticated;

CREATE OR REPLACE FUNCTION public.gestionar_grupo_tutor(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_asig_id UUID;
  v_periodo_id UUID;
  v_tutorado_id UUID;
  v_cupo INTEGER;
  v_actual INTEGER;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN
    RAISE EXCEPTION 'Solo tutores pueden gestionar su grupo.';
  END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  SELECT at2.id, at2.cupo_maximo INTO v_asig_id, v_cupo
  FROM public.asignaciones_tutor at2
  WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
    AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
  ORDER BY at2.creado_en DESC
  LIMIT 1;

  IF v_asig_id IS NULL THEN
    RAISE EXCEPTION 'No tienes un grupo tutorial activo en el periodo actual.';
  END IF;

  v_actual := public.fn_conteo_tutorados_grupo(v_asig_id);

  CASE lower(trim(p_accion))

  WHEN 'resumen' THEN
    SELECT jsonb_build_object(
      'ok', TRUE,
      'asignacion_id', v_asig_id,
      'cupo_maximo', v_cupo,
      'tutorados_asignados', v_actual,
      'cupo_disponible', GREATEST(v_cupo - v_actual, 0),
      'grupo', row_to_json(g)::JSONB
    ) INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.semestre_generacional,
             at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo
      FROM public.asignaciones_tutor at2 WHERE at2.id = v_asig_id
    ) g;
    RETURN v_result;

  WHEN 'listar_tutorados' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.nombre_completo), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT p.id, p.nombre_completo, p.numero_control, p.carrera, p.correo_institucional,
             p.estado, att.id AS asignacion_tutorado_id, att.fecha_asignacion
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
      ORDER BY p.nombre_completo
    ) t;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result, 'cupo_maximo', v_cupo, 'asignados', v_actual);

  WHEN 'desasignar' THEN
    v_tutorado_id := (p_datos->>'tutorado_id')::UUID;
    IF v_tutorado_id IS NULL THEN RAISE EXCEPTION 'tutorado_id obligatorio.'; END IF;
    UPDATE public.asignaciones_tutorado SET activa = FALSE
    WHERE asignacion_id = v_asig_id AND tutorado_id = v_tutorado_id AND activa = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El tutorado no pertenece a tu grupo.'; END IF;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado desasignado del grupo.');

  ELSE
    RAISE EXCEPTION 'Acción no válida. Use resumen, listar_tutorados o desasignar.';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_mi_tutor_tutorado()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_periodo_id UUID;
  v_row RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutorado') THEN
    RAISE EXCEPTION 'Solo tutorados pueden consultar su tutor.';
  END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  SELECT * INTO v_row
  FROM public.v_tutorado_mi_tutor
  WHERE tutorado_id = v_uid
    AND (v_periodo_id IS NULL OR periodo_id = v_periodo_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'tiene_tutor', FALSE,
      'mensaje', 'Aún no tienes tutor asignado para este semestre.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'tiene_tutor', TRUE,
    'tutor', row_to_json(v_row)::JSONB
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_actividades_grupo(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_asig_id UUID;
  v_act_id UUID;
  v_fecha_limite DATE;
  v_fecha_prog DATE;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN
    RAISE EXCEPTION 'Solo tutores pueden ajustar fechas de su grupo.';
  END IF;

  SELECT at2.id INTO v_asig_id
  FROM public.asignaciones_tutor at2
  JOIN public.periodos_escolares pe ON pe.id = at2.periodo_id AND pe.activo = TRUE
  WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
  ORDER BY at2.creado_en DESC LIMIT 1;

  IF v_asig_id IS NULL THEN RAISE EXCEPTION 'No tienes grupo activo.'; END IF;

  CASE lower(trim(p_accion))

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::JSONB ORDER BY x.fecha_programada), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT ap.id, ap.nombre, ap.fase, ap.tipo_sesion, ap.fecha_programada,
             ap.fecha_limite_evidencia AS fecha_limite_oficial,
             ag.fecha_limite_evidencia AS fecha_limite_grupo,
             ag.fecha_programada_grupo,
             public.fn_fecha_limite_grupo(ap.id, v_asig_id) AS fecha_limite_vigente,
             ap.requiere_evidencia, ap.estado
      FROM public.actividades_pt ap
      LEFT JOIN public.actividades_grupo ag
        ON ag.actividad_pt_id = ap.id AND ag.asignacion_id = v_asig_id
      WHERE ap.estado = 'activa'
      ORDER BY ap.fecha_programada
    ) x;
    RETURN jsonb_build_object('ok', TRUE, 'actividades', v_result, 'asignacion_id', v_asig_id);

  WHEN 'actualizar_fecha' THEN
    v_act_id := (p_datos->>'actividad_pt_id')::UUID;
    v_fecha_limite := nullif(p_datos->>'fecha_limite_evidencia', '')::DATE;
    v_fecha_prog := nullif(p_datos->>'fecha_programada_grupo', '')::DATE;
    IF v_act_id IS NULL THEN RAISE EXCEPTION 'actividad_pt_id obligatorio.'; END IF;

    INSERT INTO public.actividades_grupo (
      actividad_pt_id, asignacion_id, fecha_limite_evidencia, fecha_programada_grupo, actualizado_por
    ) VALUES (
      v_act_id, v_asig_id, v_fecha_limite, v_fecha_prog, v_uid
    )
    ON CONFLICT (actividad_pt_id, asignacion_id) DO UPDATE SET
      fecha_limite_evidencia = COALESCE(EXCLUDED.fecha_limite_evidencia, actividades_grupo.fecha_limite_evidencia),
      fecha_programada_grupo = COALESCE(EXCLUDED.fecha_programada_grupo, actividades_grupo.fecha_programada_grupo),
      actualizado_por = v_uid,
      actualizado_en = NOW();

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Fechas actualizadas solo para tu grupo.');

  ELSE
    RAISE EXCEPTION 'Acción no válida. Use listar o actualizar_fecha.';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_asistencias_tutor(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_asig_id UUID;
  v_sesion_id UUID;
  v_result JSONB;
  v_cerrada BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  SELECT at2.id INTO v_asig_id
  FROM public.asignaciones_tutor at2
  JOIN public.periodos_escolares pe ON pe.id = at2.periodo_id AND pe.activo = TRUE
  WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
  ORDER BY at2.creado_en DESC LIMIT 1;

  IF v_asig_id IS NULL THEN RAISE EXCEPTION 'Sin grupo activo.'; END IF;

  CASE lower(trim(p_accion))

  WHEN 'listar_sesiones' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.fecha_realizada DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT s.id, s.fecha_realizada, s.cerrada, ap.nombre AS actividad_nombre
      FROM public.sesiones s
      LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
      WHERE s.asignacion_id = v_asig_id
    ) s;
    RETURN jsonb_build_object('ok', TRUE, 'sesiones', v_result);

  WHEN 'listar_matriz' THEN
    v_sesion_id := (p_datos->>'sesion_id')::UUID;
    IF v_sesion_id IS NULL THEN RAISE EXCEPTION 'sesion_id obligatorio.'; END IF;
    SELECT cerrada INTO v_cerrada FROM public.sesiones WHERE id = v_sesion_id AND asignacion_id = v_asig_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada en tu grupo.'; END IF;
    SELECT COALESCE(jsonb_agg(row_to_json(m)::JSONB ORDER BY m.nombre_completo), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT p.id AS tutorado_id, p.nombre_completo, p.numero_control,
             COALESCE(a.estado::TEXT, 'presente') AS estado,
             a.observaciones
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      LEFT JOIN public.asistencias a ON a.sesion_id = v_sesion_id AND a.tutorado_id = p.id
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
      ORDER BY p.nombre_completo
    ) m;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result, 'sesion_cerrada', v_cerrada);

  WHEN 'registrar' THEN
    v_sesion_id := (p_datos->>'sesion_id')::UUID;
    SELECT cerrada INTO v_cerrada FROM public.sesiones WHERE id = v_sesion_id AND asignacion_id = v_asig_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
    IF v_cerrada THEN
      RAISE EXCEPTION 'Esta sesión ya fue cerrada; contacte al coordinador para reabrirla.';
    END IF;
    INSERT INTO public.asistencias (sesion_id, tutorado_id, estado, capturado_por)
    SELECT v_sesion_id, (elem->>'tutorado_id')::UUID, (elem->>'estado')::estado_asistencia, v_uid
    FROM jsonb_array_elements(COALESCE(p_datos->'registros', '[]'::JSONB)) elem
    ON CONFLICT (sesion_id, tutorado_id) DO UPDATE SET
      estado = EXCLUDED.estado,
      capturado_por = v_uid,
      fecha_captura = NOW();
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Asistencia registrada correctamente.');

  WHEN 'crear_sesion' THEN
    INSERT INTO public.sesiones (asignacion_id, actividad_pt_id, fecha_realizada, creado_por)
    VALUES (
      v_asig_id,
      nullif(p_datos->>'actividad_pt_id', '')::UUID,
      (p_datos->>'fecha_realizada')::DATE,
      v_uid
    ) RETURNING id INTO v_sesion_id;
    RETURN jsonb_build_object('ok', TRUE, 'sesion_id', v_sesion_id, 'mensaje', 'Sesión creada.');

  ELSE
    RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_evidencias_tutor(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_asig_id UUID;
  v_evidencia_id UUID;
  v_estado estado_evidencia;
  v_retro TEXT;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  SELECT at2.id INTO v_asig_id
  FROM public.asignaciones_tutor at2
  JOIN public.periodos_escolares pe ON pe.id = at2.periodo_id AND pe.activo = TRUE
  WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
  ORDER BY at2.creado_en DESC LIMIT 1;

  IF v_asig_id IS NULL THEN RAISE EXCEPTION 'Sin grupo activo.'; END IF;

  CASE lower(trim(p_accion))

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(e)::JSONB ORDER BY e.fecha_entrega DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT ev.id, ev.estado, ev.retroalimentacion, ev.comentario_alumno,
             ev.archivo_nombre, ev.archivo_url, ev.fecha_entrega,
             p.nombre_completo AS tutorado_nombre, p.numero_control,
             ap.nombre AS actividad_nombre
      FROM public.evidencias ev
      JOIN public.perfiles p ON p.id = ev.tutorado_id
      JOIN public.actividades_pt ap ON ap.id = ev.actividad_pt_id
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE att.asignacion_id = v_asig_id
    ) e;
    RETURN jsonb_build_object('ok', TRUE, 'evidencias', v_result);

  WHEN 'evaluar' THEN
    v_evidencia_id := (p_datos->>'evidencia_id')::UUID;
    v_estado := (p_datos->>'estado')::estado_evidencia;
    v_retro := nullif(trim(p_datos->>'retroalimentacion'), '');
    IF v_evidencia_id IS NULL OR v_estado IS NULL THEN
      RAISE EXCEPTION 'evidencia_id y estado son obligatorios.';
    END IF;
    IF v_estado IN ('requiere_correccion', 'rechazada') AND v_retro IS NULL THEN
      RAISE EXCEPTION 'La retroalimentación es obligatoria cuando el resultado es Requiere corrección o Rechazada.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.evidencias ev
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE ev.id = v_evidencia_id AND att.asignacion_id = v_asig_id
    ) THEN
      RAISE EXCEPTION 'No puede evaluar evidencias de tutorados ajenos a su grupo.';
    END IF;
    UPDATE public.evidencias SET
      estado = v_estado,
      retroalimentacion = v_retro,
      evaluada_por = v_uid,
      fecha_evaluacion = NOW()
    WHERE id = v_evidencia_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Evidencia evaluada correctamente.');

  ELSE
    RAISE EXCEPTION 'Acción no válida. Use listar o evaluar.';
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_grupo_tutor(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_mi_tutor_tutorado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_actividades_grupo(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_asistencias_tutor(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_evidencias_tutor(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fecha_limite_grupo(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_conteo_tutorados_grupo(UUID) TO authenticated;

ALTER TABLE public.actividades_grupo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "actividades_grupo_ver" ON public.actividades_grupo;
CREATE POLICY "actividades_grupo_ver" ON public.actividades_grupo FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "actividades_grupo_tutor" ON public.actividades_grupo;
CREATE POLICY "actividades_grupo_tutor" ON public.actividades_grupo FOR ALL
  USING (
    public.fn_tiene_rol('tutor') AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at2
      WHERE at2.id = actividades_grupo.asignacion_id AND at2.tutor_id = auth.uid()
    )
  );
