-- ============================================================
-- SGPT — Actividades generales + asistencia sin defecto
-- Ejecutar DESPUÉS de: contexto.sql, sgpt_gestion_rpc.sql,
--   sgpt_grupos_tutoria.sql, sgpt_tutor_grupos_multiples.sql,
--   sgpt_sesiones_8_semestre.sql, sgpt_editar_grupos_v2.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.gestionar_actividades_pt(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_prog_id UUID;
  v_act_id  UUID;
  v_nombre  TEXT;
  v_result  JSONB;
  v_estado  estado_actividad;
  v_tipos   TEXT[];
  v_req     BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;

  CASE lower(trim(p_accion))

  WHEN 'listar_programas' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(p)::JSONB ORDER BY p.nombre), '[]'::JSONB) INTO v_result
    FROM (SELECT id, nombre, periodo_id, activo FROM public.programas_tutorias ORDER BY activo DESC, nombre) p;
    RETURN jsonb_build_object('ok', TRUE, 'programas', v_result);

  WHEN 'listar' THEN
    v_prog_id := (p_datos->>'programa_id')::UUID;
    IF v_prog_id IS NULL THEN RAISE EXCEPTION 'programa_id es obligatorio.'; END IF;
    SELECT COALESCE(jsonb_agg(row_to_json(a)::JSONB ORDER BY a.fecha_programada), '[]'::JSONB) INTO v_result
    FROM (
      SELECT id, programa_id, nombre, descripcion, tipo_sesion, fase, fecha_programada,
             requiere_evidencia, tipo_archivo_aceptado, fecha_limite_evidencia, estado
      FROM public.actividades_pt WHERE programa_id = v_prog_id ORDER BY fecha_programada
    ) a;
    RETURN jsonb_build_object('ok', TRUE, 'actividades', v_result);

  WHEN 'crear' THEN
    IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
      RAISE EXCEPTION 'Solo el Coordinador Institucional puede crear actividades del PT.';
    END IF;
    v_prog_id := (p_datos->>'programa_id')::UUID;
    v_nombre  := trim(p_datos->>'nombre');
    v_req     := coalesce((p_datos->>'requiere_evidencia')::BOOLEAN, FALSE);
    IF v_prog_id IS NULL OR v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'programa_id y nombre son obligatorios.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.programas_tutorias WHERE id = v_prog_id) THEN
      RAISE EXCEPTION 'Programa de tutorías no encontrado.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.actividades_pt ap
      WHERE ap.programa_id = v_prog_id AND lower(ap.nombre) = lower(v_nombre)
        AND ap.fase = (p_datos->>'fase')::fase_pt
    ) THEN
      RAISE EXCEPTION 'Ya existe una actividad con ese nombre en esta fase del programa.';
    END IF;

    v_tipos := NULL;
    IF p_datos ? 'tipo_archivo_aceptado' AND jsonb_typeof(p_datos->'tipo_archivo_aceptado') = 'array' THEN
      v_tipos := ARRAY(SELECT jsonb_array_elements_text(p_datos->'tipo_archivo_aceptado'));
    END IF;
    IF v_req AND (v_tipos IS NULL OR cardinality(v_tipos) = 0) THEN
      v_tipos := ARRAY['pdf', 'docx', 'jpg'];
    END IF;

    INSERT INTO public.actividades_pt (
      programa_id, nombre, descripcion, tipo_sesion, fase, fecha_programada,
      requiere_evidencia, tipo_archivo_aceptado, fecha_limite_evidencia, creado_por, estado
    ) VALUES (
      v_prog_id, v_nombre, nullif(trim(p_datos->>'descripcion'), ''),
      coalesce((p_datos->>'tipo_sesion')::tipo_sesion, 'grupal'),
      coalesce((p_datos->>'fase')::fase_pt, 'diagnostico'),
      (p_datos->>'fecha_programada')::DATE,
      v_req, v_tipos,
      nullif(p_datos->>'fecha_limite_evidencia', '')::DATE,
      v_uid, 'activa'
    ) RETURNING id INTO v_act_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Actividad registrada', 'actividad_id', v_act_id);

  WHEN 'actualizar' THEN
    IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
      RAISE EXCEPTION 'Solo el Coordinador Institucional puede modificar actividades del PT.';
    END IF;
    v_act_id := (p_datos->>'actividad_id')::UUID;
    IF v_act_id IS NULL THEN RAISE EXCEPTION 'actividad_id obligatorio.'; END IF;
    v_req := coalesce((p_datos->>'requiere_evidencia')::BOOLEAN, FALSE);
    IF p_datos ? 'tipo_archivo_aceptado' AND jsonb_typeof(p_datos->'tipo_archivo_aceptado') = 'array' THEN
      v_tipos := ARRAY(SELECT jsonb_array_elements_text(p_datos->'tipo_archivo_aceptado'));
    END IF;
    UPDATE public.actividades_pt SET
      nombre             = coalesce(nullif(trim(p_datos->>'nombre'), ''), nombre),
      descripcion        = coalesce(nullif(trim(p_datos->>'descripcion'), ''), descripcion),
      tipo_sesion        = coalesce((p_datos->>'tipo_sesion')::tipo_sesion, tipo_sesion),
      fase               = coalesce((p_datos->>'fase')::fase_pt, fase),
      fecha_programada   = coalesce((p_datos->>'fecha_programada')::DATE, fecha_programada),
      requiere_evidencia = v_req,
      tipo_archivo_aceptado = CASE WHEN v_tipos IS NOT NULL THEN v_tipos ELSE tipo_archivo_aceptado END,
      fecha_limite_evidencia = coalesce(nullif(p_datos->>'fecha_limite_evidencia', '')::DATE, fecha_limite_evidencia),
      actualizado_en     = NOW()
    WHERE id = v_act_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Actividad actualizada');

  WHEN 'cambiar_estado' THEN
    IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
      RAISE EXCEPTION 'Solo el Coordinador Institucional puede cambiar el estado.';
    END IF;
    v_act_id := (p_datos->>'actividad_id')::UUID;
    v_estado := (p_datos->>'estado')::estado_actividad;
    IF v_act_id IS NULL OR v_estado IS NULL THEN RAISE EXCEPTION 'actividad_id y estado son obligatorios.'; END IF;
    UPDATE public.actividades_pt SET estado = v_estado, actualizado_en = NOW() WHERE id = v_act_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Estado actualizado', 'estado', v_estado);

  ELSE RAISE EXCEPTION 'Acción no válida: %', p_accion;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_actividades_pt(TEXT, JSONB) TO authenticated;


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
  v_uid        UUID  := auth.uid();
  v_asig_id    UUID;
  v_periodo_id UUID;
  v_planificadas BOOLEAN;
  v_result     JSONB;
  v_sesion_id  UUID;
  v_cerrada    BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;

  v_asig_id := (p_datos->>'asignacion_id')::UUID;

  SELECT pe.id INTO v_periodo_id
  FROM public.periodos_escolares pe WHERE pe.activo = TRUE LIMIT 1;

  IF v_asig_id IS NOT NULL THEN
    SELECT sesiones_planificadas INTO v_planificadas
    FROM public.asignaciones_tutor WHERE id = v_asig_id;
  END IF;

  CASE lower(trim(p_accion))

  WHEN 'matriz_semestre' THEN
    IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;
    IF NOT COALESCE(v_planificadas, FALSE) THEN
      RAISE EXCEPTION 'Este grupo no tiene las 8 sesiones planificadas. Configúralas al crear el grupo.';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB) INTO v_result
    FROM (
      SELECT s.id, s.numero_sesion, s.fecha_realizada, s.cerrada, s.actividad_pt_id,
             ap.nombre AS actividad_nombre
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
          'tutorado_id',    a.tutorado_id,
          'sesion_id',      a.sesion_id,
          'numero_sesion',  s.numero_sesion,
          'estado',         a.estado,
          'evidencia_estado', ev.estado,
          'evidencia_id',   ev.id,
          'calificacion',   ev.calificacion
        )), '[]'::JSONB)
        FROM public.asistencias a
        JOIN public.sesiones s ON s.id = a.sesion_id
        LEFT JOIN public.evidencias ev ON ev.sesion_id = a.sesion_id AND ev.tutorado_id = a.tutorado_id
        WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
      )
    );

  WHEN 'registrar_matriz' THEN
    IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;

    DELETE FROM public.asistencias
    WHERE sesion_id IN (
      SELECT id FROM public.sesiones
      WHERE asignacion_id = v_asig_id AND NOT cerrada AND numero_sesion IS NOT NULL
    )
    AND (sesion_id, tutorado_id) NOT IN (
      SELECT
        (elem->>'sesion_id')::UUID,
        (elem->>'tutorado_id')::UUID
      FROM jsonb_array_elements(COALESCE(p_datos->'registros', '[]'::JSONB)) elem
      WHERE (elem->>'sesion_id') IS NOT NULL AND (elem->>'tutorado_id') IS NOT NULL
    );

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

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Asistencia guardada correctamente.');

  WHEN 'promedios_grupo' THEN
    IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(r)::JSONB ORDER BY r.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT
        p.id AS tutorado_id, p.nombre_completo, p.numero_control,
        ROUND(AVG(ev.calificacion)::NUMERIC, 2) AS promedio_actividades,
        COUNT(ev.id) FILTER (WHERE ev.estado = 'aceptada') AS actividades_aceptadas,
        COUNT(a.sesion_id) FILTER (WHERE a.estado = 'presente') AS sesiones_presentes,
        COUNT(s.id) AS total_sesiones
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      LEFT JOIN public.sesiones s ON s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
      LEFT JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = p.id
      LEFT JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = p.id
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
      GROUP BY p.id, p.nombre_completo, p.numero_control
    ) r;
    RETURN jsonb_build_object('ok', TRUE, 'promedios', v_result);

  ELSE RAISE EXCEPTION 'Acción no válida: %', p_accion;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_asistencias_tutor(TEXT, JSONB) TO authenticated;
