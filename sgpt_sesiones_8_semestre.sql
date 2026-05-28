-- ============================================================
-- SGPT — 8 sesiones por semestre/grupo, matriz asistencia, calificación 1-4
-- Ejecutar después de sgpt_tutor_grupos_multiples.sql
-- ============================================================

ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS numero_sesion SMALLINT;

ALTER TABLE public.asignaciones_tutor
  ADD COLUMN IF NOT EXISTS sesiones_planificadas BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.evidencias
  ADD COLUMN IF NOT EXISTS sesion_id UUID REFERENCES public.sesiones(id) ON DELETE SET NULL;

ALTER TABLE public.evidencias
  ADD COLUMN IF NOT EXISTS calificacion SMALLINT;

ALTER TABLE public.evidencias
  DROP CONSTRAINT IF EXISTS chk_evidencia_calificacion;

ALTER TABLE public.evidencias
  ADD CONSTRAINT chk_evidencia_calificacion
  CHECK (calificacion IS NULL OR (calificacion >= 1 AND calificacion <= 4));

DROP INDEX IF EXISTS public.uq_sesion_numero_grupo;
CREATE UNIQUE INDEX uq_sesion_numero_grupo
  ON public.sesiones (asignacion_id, numero_sesion)
  WHERE numero_sesion IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_validar_sesiones_semanales(p_sesiones JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_len INTEGER;
  v_prev DATE;
  v_curr DATE;
  v_num INTEGER;
  v_i INTEGER;
  v_elem JSONB;
BEGIN
  v_len := jsonb_array_length(COALESCE(p_sesiones, '[]'::JSONB));
  IF v_len <> 8 THEN
    RAISE EXCEPTION 'Debes planificar exactamente 8 sesiones (una por semana). Recibidas: %.', v_len;
  END IF;
  FOR v_i IN 0..7 LOOP
    v_elem := p_sesiones->v_i;
    v_num := (v_elem->>'numero_sesion')::INTEGER;
    v_curr := (v_elem->>'fecha_realizada')::DATE;
    IF v_num IS NULL OR v_num < 1 OR v_num > 8 THEN
      RAISE EXCEPTION 'Cada sesión debe tener numero_sesion entre 1 y 8.';
    END IF;
    IF v_num <> v_i + 1 THEN
      RAISE EXCEPTION 'Las sesiones deben numerarse del 1 al 8 en orden.';
    END IF;
    IF v_curr IS NULL THEN
      RAISE EXCEPTION 'Falta fecha_realizada en la sesión %.', v_num;
    END IF;
    IF v_i > 0 AND v_prev IS NOT NULL THEN
      IF v_curr <= v_prev THEN
        RAISE EXCEPTION 'Las fechas deben ser crecientes (una por semana).';
      END IF;
      IF (v_curr - v_prev) < 6 OR (v_curr - v_prev) > 8 THEN
        RAISE EXCEPTION 'Entre sesiones % y % debe haber aproximadamente 7 días.', v_i, v_i + 1;
      END IF;
    END IF;
    v_prev := v_curr;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_crear_sesiones_planificadas(
  p_asignacion_id UUID,
  p_sesiones     JSONB,
  p_creado_por   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elem JSONB;
  v_cnt INTEGER;
BEGIN
  PERFORM public.fn_validar_sesiones_semanales(p_sesiones);

  SELECT COUNT(*)::INTEGER INTO v_cnt
  FROM public.sesiones
  WHERE asignacion_id = p_asignacion_id AND numero_sesion IS NOT NULL;

  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'Este grupo ya tiene sesiones planificadas.';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_sesiones)
  LOOP
    INSERT INTO public.sesiones (
      asignacion_id, actividad_pt_id, fecha_realizada, numero_sesion, creado_por
    ) VALUES (
      p_asignacion_id,
      nullif(v_elem->>'actividad_pt_id', '')::UUID,
      (v_elem->>'fecha_realizada')::DATE,
      (v_elem->>'numero_sesion')::SMALLINT,
      p_creado_por
    );
  END LOOP;

  UPDATE public.asignaciones_tutor
  SET sesiones_planificadas = TRUE, actualizado_en = NOW()
  WHERE id = p_asignacion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_grupo_tutor(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_asig_id UUID;
  v_periodo_id UUID;
  v_tutorado_id UUID;
  v_cupo INTEGER;
  v_actual INTEGER;
  v_result JSONB;
  v_hora_inicio TIME;
  v_hora_fin TIME;
  v_carrera TEXT;
  v_grupo TEXT;
  v_dia TEXT;
  v_salon TEXT;
  v_semestre TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;
  v_asig_id := nullif(p_datos->>'asignacion_id', '')::UUID;

  CASE lower(trim(p_accion))

  WHEN 'listar_grupos' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(g)::JSONB ORDER BY g.creado_en DESC), '[]'::JSONB) INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.semestre_generacional,
             at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo,
             at2.sesiones_planificadas,
             public.fn_conteo_tutorados_grupo(at2.id) AS tutorados_asignados,
             GREATEST(at2.cupo_maximo - public.fn_conteo_tutorados_grupo(at2.id), 0) AS cupo_disponible,
             (SELECT COUNT(*)::INTEGER FROM public.sesiones s WHERE s.asignacion_id = at2.id AND s.numero_sesion IS NOT NULL) AS total_sesiones,
             at2.creado_en
      FROM public.asignaciones_tutor at2
      WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
        AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
    ) g;
    RETURN jsonb_build_object('ok', TRUE, 'grupos', v_result, 'periodo_id', v_periodo_id);

  WHEN 'crear_grupo' THEN
    IF v_periodo_id IS NULL THEN RAISE EXCEPTION 'No hay periodo escolar activo.'; END IF;
    v_carrera := trim(p_datos->>'carrera');
    v_grupo := trim(p_datos->>'grupo');
    v_dia := trim(p_datos->>'dia_semana');
    v_salon := coalesce(nullif(trim(p_datos->>'salon'), ''), 'Por asignar');
    v_semestre := coalesce(nullif(trim(p_datos->>'semestre_generacional'), ''), v_grupo);
    v_hora_inicio := (p_datos->>'hora_inicio')::TIME;
    IF v_carrera IS NULL OR v_carrera = '' THEN RAISE EXCEPTION 'Carrera obligatoria.'; END IF;
    IF v_grupo IS NULL OR v_grupo = '' THEN RAISE EXCEPTION 'Grupo obligatorio.'; END IF;
    IF v_dia IS NULL OR v_dia = '' THEN RAISE EXCEPTION 'Día obligatorio.'; END IF;
    IF v_hora_inicio IS NULL THEN RAISE EXCEPTION 'Hora de inicio obligatoria.'; END IF;
    IF p_datos->'sesiones' IS NULL THEN
      RAISE EXCEPTION 'Debes planificar 8 sesiones semanales al crear el grupo.';
    END IF;
    v_hora_fin := v_hora_inicio + INTERVAL '1 hour';

    INSERT INTO public.asignaciones_tutor (
      periodo_id, tutor_id, carrera, semestre_generacional, grupo,
      dia_semana, hora_inicio, hora_fin, salon, asignado_por, cupo_maximo
    ) VALUES (
      v_periodo_id, v_uid, v_carrera, v_semestre, v_grupo,
      v_dia, v_hora_inicio, v_hora_fin::TIME, v_salon, v_uid,
      coalesce((p_datos->>'cupo_maximo')::INTEGER, 25)
    ) RETURNING id INTO v_asig_id;

    PERFORM public.fn_crear_sesiones_planificadas(v_asig_id, p_datos->'sesiones', v_uid);

    SELECT row_to_json(g)::JSONB INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.dia_semana, at2.hora_inicio, at2.hora_fin,
             at2.salon, at2.cupo_maximo, at2.sesiones_planificadas
      FROM public.asignaciones_tutor at2 WHERE at2.id = v_asig_id
    ) g;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Grupo y 8 sesiones creados.', 'grupo', v_result);

  WHEN 'resumen' THEN
    IF v_asig_id IS NULL THEN
      SELECT at2.id INTO v_asig_id FROM public.asignaciones_tutor at2
      WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
        AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
      ORDER BY at2.creado_en DESC LIMIT 1;
    END IF;
    IF v_asig_id IS NULL THEN
      RETURN jsonb_build_object('ok', TRUE, 'sin_grupos', TRUE);
    END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN
      RAISE EXCEPTION 'Grupo no válido.';
    END IF;
    SELECT cupo_maximo INTO v_cupo FROM public.asignaciones_tutor WHERE id = v_asig_id;
    v_actual := public.fn_conteo_tutorados_grupo(v_asig_id);
    SELECT jsonb_build_object(
      'ok', TRUE, 'asignacion_id', v_asig_id, 'cupo_maximo', v_cupo,
      'tutorados_asignados', v_actual, 'cupo_disponible', GREATEST(v_cupo - v_actual, 0),
      'sesiones_planificadas', (SELECT at2.sesiones_planificadas FROM public.asignaciones_tutor at2 WHERE at2.id = v_asig_id),
      'grupo', row_to_json(g)::JSONB
    ) INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo
      FROM public.asignaciones_tutor at2 WHERE at2.id = v_asig_id
    ) g;
    RETURN v_result;

  WHEN 'listar_tutorados' THEN
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'asignacion_id obligatorio.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;
    SELECT cupo_maximo INTO v_cupo FROM public.asignaciones_tutor WHERE id = v_asig_id;
    v_actual := public.fn_conteo_tutorados_grupo(v_asig_id);
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT p.id, p.nombre_completo, p.numero_control, p.carrera, p.correo_institucional, p.estado
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
    ) t;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result, 'cupo_maximo', v_cupo, 'asignados', v_actual);

  WHEN 'asignar_tutorado' THEN
    v_tutorado_id := (p_datos->>'tutorado_id')::UUID;
    IF v_asig_id IS NULL OR v_tutorado_id IS NULL THEN RAISE EXCEPTION 'asignacion_id y tutorado_id obligatorios.'; END IF;
    IF v_periodo_id IS NULL THEN RAISE EXCEPTION 'No hay periodo activo.'; END IF;
    PERFORM public.fn_asignar_tutorado_a_grupo(v_tutorado_id, v_asig_id, v_periodo_id, v_uid);
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado asignado al grupo.');

  WHEN 'desasignar' THEN
    v_tutorado_id := (p_datos->>'tutorado_id')::UUID;
    IF v_asig_id IS NULL THEN
      SELECT att.asignacion_id INTO v_asig_id
      FROM public.asignaciones_tutorado att
      JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE att.tutorado_id = v_tutorado_id AND att.activa = TRUE AND at2.tutor_id = v_uid
      LIMIT 1;
    END IF;
    UPDATE public.asignaciones_tutorado SET activa = FALSE
    WHERE asignacion_id = v_asig_id AND tutorado_id = v_tutorado_id AND activa = TRUE;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado desasignado.');

  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_sesiones_grupo(
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
  v_periodo_id UUID;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);
  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  CASE lower(trim(p_accion))

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB) INTO v_result
    FROM (
      SELECT s.id, s.numero_sesion, s.fecha_realizada, s.cerrada, s.actividad_pt_id,
             ap.nombre AS actividad_nombre, ap.requiere_evidencia
      FROM public.sesiones s
      LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
      WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
    ) s;
    RETURN jsonb_build_object('ok', TRUE, 'sesiones', v_result, 'asignacion_id', v_asig_id,
      'sesiones_planificadas', (SELECT sesiones_planificadas FROM public.asignaciones_tutor WHERE id = v_asig_id));

  WHEN 'vincular_actividad' THEN
    v_sesion_id := (p_datos->>'sesion_id')::UUID;
    IF v_sesion_id IS NULL THEN RAISE EXCEPTION 'sesion_id obligatorio.'; END IF;
    UPDATE public.sesiones SET actividad_pt_id = nullif(p_datos->>'actividad_pt_id', '')::UUID
    WHERE id = v_sesion_id AND asignacion_id = v_asig_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada.'; END IF;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Actividad vinculada a la sesión.');

  WHEN 'listar_actividades' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(a)::JSONB ORDER BY a.fecha_programada), '[]'::JSONB) INTO v_result
    FROM (
      SELECT ap.id, ap.nombre, ap.fase, ap.fecha_programada, ap.requiere_evidencia
      FROM public.actividades_pt ap
      WHERE ap.estado = 'activa'
    ) a;
    RETURN jsonb_build_object('ok', TRUE, 'actividades', v_result);

  ELSE RAISE EXCEPTION 'Acción no válida. Use listar, vincular_actividad o listar_actividades.';
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
  v_periodo_id UUID;
  v_planificadas BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);
  SELECT sesiones_planificadas INTO v_planificadas FROM public.asignaciones_tutor WHERE id = v_asig_id;
  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  CASE lower(trim(p_accion))

  WHEN 'matriz_semestre' THEN
    IF NOT COALESCE(v_planificadas, FALSE) THEN
      RAISE EXCEPTION 'Este grupo no tiene las 8 sesiones planificadas. Configúralas al crear el grupo.';
    END IF;
    SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB) INTO v_result
    FROM (
      SELECT s.id, s.numero_sesion, s.fecha_realizada, s.cerrada, s.actividad_pt_id, ap.nombre AS actividad_nombre
      FROM public.sesiones s
      LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
      WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
    ) s;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'asignacion_id', v_asig_id,
      'periodo_id', v_periodo_id,
      'sesiones', v_result,
      'tutorados', (
        SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.nombre_completo), '[]'::JSONB)
        FROM (
          SELECT p.id AS tutorado_id, p.nombre_completo, p.numero_control
          FROM public.asignaciones_tutorado att
          JOIN public.perfiles p ON p.id = att.tutorado_id
          WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
        ) t
      ),
      'celdas', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'tutorado_id', a.tutorado_id,
          'sesion_id', a.sesion_id,
          'numero_sesion', s.numero_sesion,
          'estado', COALESCE(a.estado::TEXT, 'presente'),
          'evidencia_estado', ev.estado,
          'evidencia_id', ev.id,
          'evidencia_nombre', ev.archivo_nombre,
          'calificacion', ev.calificacion
        )), '[]'::JSONB)
        FROM public.sesiones s
        CROSS JOIN (
          SELECT att.tutorado_id FROM public.asignaciones_tutorado att
          WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
        ) tut
        LEFT JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = tut.tutorado_id
        LEFT JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = tut.tutorado_id
          AND (v_periodo_id IS NULL OR ev.periodo_id = v_periodo_id)
        WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
      )
    );

  WHEN 'registrar_matriz' THEN
    INSERT INTO public.asistencias (sesion_id, tutorado_id, estado, capturado_por)
    SELECT
      (elem->>'sesion_id')::UUID,
      (elem->>'tutorado_id')::UUID,
      (elem->>'estado')::estado_asistencia,
      v_uid
    FROM jsonb_array_elements(COALESCE(p_datos->'registros', '[]'::JSONB)) elem
    WHERE EXISTS (
      SELECT 1 FROM public.sesiones s
      WHERE s.id = (elem->>'sesion_id')::UUID AND s.asignacion_id = v_asig_id AND NOT s.cerrada
    )
    ON CONFLICT (sesion_id, tutorado_id) DO UPDATE SET
      estado = EXCLUDED.estado, capturado_por = v_uid, fecha_captura = NOW();
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Asistencia del semestre guardada.');

  WHEN 'listar_sesiones' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion NULLS LAST, s.fecha_realizada DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT s.id, s.numero_sesion, s.fecha_realizada, s.cerrada, ap.nombre AS actividad_nombre
      FROM public.sesiones s
      LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
      WHERE s.asignacion_id = v_asig_id
    ) s;
    RETURN jsonb_build_object('ok', TRUE, 'sesiones', v_result, 'asignacion_id', v_asig_id);

  WHEN 'listar_matriz' THEN
    v_sesion_id := (p_datos->>'sesion_id')::UUID;
    SELECT cerrada INTO v_cerrada FROM public.sesiones WHERE id = v_sesion_id AND asignacion_id = v_asig_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
    SELECT COALESCE(jsonb_agg(row_to_json(m)::JSONB ORDER BY m.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT p.id AS tutorado_id, p.nombre_completo, p.numero_control,
             COALESCE(a.estado::TEXT, 'presente') AS estado
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      LEFT JOIN public.asistencias a ON a.sesion_id = v_sesion_id AND a.tutorado_id = p.id
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
    ) m;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result, 'sesion_cerrada', v_cerrada);

  WHEN 'registrar' THEN
    v_sesion_id := (p_datos->>'sesion_id')::UUID;
    SELECT cerrada INTO v_cerrada FROM public.sesiones WHERE id = v_sesion_id AND asignacion_id = v_asig_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
    IF v_cerrada THEN RAISE EXCEPTION 'Sesión cerrada.'; END IF;
    INSERT INTO public.asistencias (sesion_id, tutorado_id, estado, capturado_por)
    SELECT v_sesion_id, (elem->>'tutorado_id')::UUID, (elem->>'estado')::estado_asistencia, v_uid
    FROM jsonb_array_elements(COALESCE(p_datos->'registros', '[]'::JSONB)) elem
    ON CONFLICT (sesion_id, tutorado_id) DO UPDATE SET estado = EXCLUDED.estado, capturado_por = v_uid, fecha_captura = NOW();
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Asistencia registrada.');

  WHEN 'crear_sesion' THEN
    RAISE EXCEPTION 'Las sesiones se planifican al crear el grupo (8 sesiones semanales).';

  ELSE RAISE EXCEPTION 'Acción no válida.';
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
  v_cal SMALLINT;
  v_result JSONB;
  v_periodo_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);
  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  CASE lower(trim(p_accion))

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(e)::JSONB ORDER BY e.fecha_entrega DESC), '[]'::JSONB) INTO v_result
    FROM (
      SELECT ev.id, ev.estado, ev.retroalimentacion, ev.comentario_alumno, ev.calificacion,
             ev.archivo_nombre, ev.archivo_url, ev.fecha_entrega, ev.sesion_id,
             p.nombre_completo AS tutorado_nombre, p.numero_control,
             ap.nombre AS actividad_nombre, s.numero_sesion
      FROM public.evidencias ev
      JOIN public.perfiles p ON p.id = ev.tutorado_id
      LEFT JOIN public.actividades_pt ap ON ap.id = ev.actividad_pt_id
      LEFT JOIN public.sesiones s ON s.id = ev.sesion_id
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE att.asignacion_id = v_asig_id
    ) e;
    RETURN jsonb_build_object('ok', TRUE, 'evidencias', v_result);

  WHEN 'evaluar' THEN
    v_evidencia_id := (p_datos->>'evidencia_id')::UUID;
    v_estado := (p_datos->>'estado')::estado_evidencia;
    v_retro := nullif(trim(p_datos->>'retroalimentacion'), '');
    v_cal := nullif(p_datos->>'calificacion', '')::SMALLINT;
    IF v_evidencia_id IS NULL OR v_estado IS NULL THEN RAISE EXCEPTION 'evidencia_id y estado obligatorios.'; END IF;
    IF v_estado IN ('requiere_correccion', 'rechazada') AND v_retro IS NULL THEN
      RAISE EXCEPTION 'Retroalimentación obligatoria.';
    END IF;
    IF v_estado = 'aceptada' AND (v_cal IS NULL OR v_cal < 1 OR v_cal > 4) THEN
      RAISE EXCEPTION 'Calificación obligatoria (1 a 4) al aceptar la evidencia.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.evidencias ev
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE ev.id = v_evidencia_id AND att.asignacion_id = v_asig_id
    ) THEN RAISE EXCEPTION 'Evidencia no válida.'; END IF;
    UPDATE public.evidencias SET
      estado = v_estado, retroalimentacion = v_retro, calificacion = CASE WHEN v_estado = 'aceptada' THEN v_cal ELSE NULL END,
      evaluada_por = v_uid, fecha_evaluacion = NOW()
    WHERE id = v_evidencia_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Evidencia evaluada.');

  WHEN 'promedios_grupo' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(p)::JSONB ORDER BY p.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT p.id AS tutorado_id, p.nombre_completo, p.numero_control,
             ROUND(AVG(ev.calificacion)::NUMERIC, 2) AS promedio_actividades,
             COUNT(ev.calificacion) AS actividades_calificadas
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      LEFT JOIN public.evidencias ev ON ev.tutorado_id = p.id AND ev.calificacion IS NOT NULL
        AND (v_periodo_id IS NULL OR ev.periodo_id = v_periodo_id)
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
      GROUP BY p.id, p.nombre_completo, p.numero_control
    ) p;
    RETURN jsonb_build_object('ok', TRUE, 'promedios', v_result);

  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_calendario_tutorado()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_periodo_id UUID;
  v_asig_id UUID;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutorado') THEN RAISE EXCEPTION 'Solo tutorados.'; END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  SELECT att.asignacion_id INTO v_asig_id
  FROM public.asignaciones_tutorado att
  WHERE att.tutorado_id = v_uid AND att.activa = TRUE
    AND (v_periodo_id IS NULL OR att.periodo_id = v_periodo_id)
  LIMIT 1;

  IF v_asig_id IS NULL THEN
    RETURN jsonb_build_object('ok', TRUE, 'tiene_grupo', FALSE, 'mensaje', 'Sin tutor asignado.');
  END IF;

  SELECT jsonb_build_object(
    'ok', TRUE,
    'tiene_grupo', TRUE,
    'grupo', (
      SELECT row_to_json(g)::JSONB FROM (
        SELECT at2.carrera, at2.grupo, at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon,
               pt.nombre_completo AS tutor_nombre
        FROM public.asignaciones_tutor at2
        JOIN public.perfiles pt ON pt.id = at2.tutor_id
        WHERE at2.id = v_asig_id
      ) g
    ),
    'sesiones', (
      SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB)
      FROM (
        SELECT s.id, s.numero_sesion, s.fecha_realizada, s.actividad_pt_id, ap.nombre AS actividad_nombre,
               ap.requiere_evidencia, ap.descripcion,
               a.estado AS asistencia_estado,
               ev.id AS evidencia_id, ev.estado AS evidencia_estado, ev.archivo_nombre, ev.calificacion
        FROM public.sesiones s
        LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
        LEFT JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = v_uid
        LEFT JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = v_uid
        WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
      ) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_sesiones_grupo(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_calendario_tutorado() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validar_sesiones_semanales(JSONB) TO authenticated;
