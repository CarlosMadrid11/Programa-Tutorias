-- Permite al tutor modificar retroalimentación y calificación de evidencias ya evaluadas

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
  v_uid          UUID := auth.uid();
  v_asig_id      UUID;
  v_evidencia_id UUID;
  v_estado       estado_evidencia;
  v_estado_prev  estado_evidencia;
  v_retro        TEXT;
  v_cal          SMALLINT;
  v_result       JSONB;
  v_periodo_id   UUID;
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
             ev.archivo_nombre, ev.archivo_url, ev.fecha_entrega, ev.fecha_evaluacion, ev.sesion_id,
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
    v_estado       := (p_datos->>'estado')::estado_evidencia;
    v_retro        := nullif(trim(p_datos->>'retroalimentacion'), '');
    v_cal          := nullif(p_datos->>'calificacion', '')::SMALLINT;
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
      estado = v_estado,
      retroalimentacion = v_retro,
      calificacion = CASE WHEN v_estado = 'aceptada' THEN v_cal ELSE NULL END,
      evaluada_por = v_uid,
      fecha_evaluacion = NOW()
    WHERE id = v_evidencia_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Evidencia evaluada.');

  WHEN 'actualizar_evaluacion' THEN
    v_evidencia_id := (p_datos->>'evidencia_id')::UUID;
    v_retro        := nullif(trim(p_datos->>'retroalimentacion'), '');
    v_cal          := nullif(p_datos->>'calificacion', '')::SMALLINT;
    IF p_datos ? 'estado' AND nullif(p_datos->>'estado', '') IS NOT NULL THEN
      v_estado := (p_datos->>'estado')::estado_evidencia;
    END IF;

    IF v_evidencia_id IS NULL THEN RAISE EXCEPTION 'evidencia_id obligatorio.'; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.evidencias ev
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE ev.id = v_evidencia_id AND att.asignacion_id = v_asig_id
    ) THEN RAISE EXCEPTION 'Evidencia no válida.'; END IF;

    SELECT estado, calificacion INTO v_estado_prev, v_cal
    FROM public.evidencias WHERE id = v_evidencia_id;

    IF v_estado IS NULL THEN v_estado := v_estado_prev; END IF;

    IF v_estado = 'aceptada' THEN
      IF v_cal IS NULL OR v_cal < 1 OR v_cal > 4 THEN
        SELECT calificacion INTO v_cal FROM public.evidencias WHERE id = v_evidencia_id;
        IF v_cal IS NULL OR v_cal < 1 OR v_cal > 4 THEN
          RAISE EXCEPTION 'Calificación obligatoria (1 a 4) para evidencias aceptadas.';
        END IF;
      END IF;
    ELSE
      v_cal := NULL;
    END IF;

    IF v_estado IN ('requiere_correccion', 'rechazada') AND v_retro IS NULL THEN
      RAISE EXCEPTION 'Retroalimentación obligatoria para este estado.';
    END IF;

    UPDATE public.evidencias SET
      estado = v_estado,
      retroalimentacion = COALESCE(v_retro, retroalimentacion),
      calificacion = CASE WHEN v_estado = 'aceptada' THEN v_cal ELSE NULL END,
      evaluada_por = v_uid,
      fecha_evaluacion = NOW()
    WHERE id = v_evidencia_id;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Evaluación actualizada.');

  WHEN 'promedios_grupo' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(p)::JSONB ORDER BY p.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT p.id AS tutorado_id, p.nombre_completo, p.numero_control,
             ROUND(AVG(ev.calificacion)::NUMERIC, 2) AS promedio_actividades,
             COUNT(ev.calificacion) FILTER (WHERE ev.estado = 'aceptada') AS actividades_calificadas
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      LEFT JOIN public.evidencias ev ON ev.tutorado_id = p.id AND ev.calificacion IS NOT NULL
        AND ev.estado = 'aceptada'
        AND (v_periodo_id IS NULL OR ev.periodo_id = v_periodo_id)
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
      GROUP BY p.id, p.nombre_completo, p.numero_control
    ) p;
    RETURN jsonb_build_object('ok', TRUE, 'promedios', v_result);

  ELSE RAISE EXCEPTION 'Acción no válida: %', p_accion;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_evidencias_tutor(TEXT, JSONB) TO authenticated;
