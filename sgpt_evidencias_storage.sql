-- ============================================================
-- SGPT — Storage evidencias + entrega RPC + seguimiento por calificaciones
-- Ejecutar después de los scripts SGPT anteriores
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidencias', 'evidencias', TRUE, 10485760)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "evidencias_storage_insert_tutorado" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_storage_update_tutorado" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_storage_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_storage_select_public" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_storage_tutor_select" ON storage.objects;

CREATE POLICY "evidencias_storage_insert_tutorado"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidencias'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "evidencias_storage_update_tutorado"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'evidencias'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'evidencias'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "evidencias_storage_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'evidencias');

DROP POLICY IF EXISTS "evidencias_actualizar_tutorado_propio" ON public.evidencias;

CREATE POLICY "evidencias_actualizar_tutorado_propio"
ON public.evidencias FOR UPDATE
USING (
  tutorado_id = auth.uid()
  AND public.fn_tiene_rol('tutorado')
  AND estado IN ('pendiente', 'requiere_correccion', 'entregada')
);


CREATE OR REPLACE FUNCTION public.gestionar_evidencias_tutorado(
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
  v_periodo_id   UUID;
  v_asig_id      UUID;
  v_tutorado_id  UUID;
  v_sesion_id    UUID;
  v_actividad_id UUID;
  v_evidencia_id UUID;
  v_result       JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutorado') THEN RAISE EXCEPTION 'Solo tutorados.'; END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  SELECT att.asignacion_id INTO v_asig_id
  FROM public.asignaciones_tutorado att
  WHERE att.tutorado_id = v_uid AND att.activa = TRUE
    AND (v_periodo_id IS NULL OR att.periodo_id = v_periodo_id)
  LIMIT 1;

  CASE lower(trim(p_accion))

  WHEN 'entregar' THEN
    v_sesion_id      := (p_datos->>'sesion_id')::UUID;
    v_actividad_id   := (p_datos->>'actividad_pt_id')::UUID;
    v_evidencia_id   := (p_datos->>'evidencia_id')::UUID;

    IF v_actividad_id IS NULL OR v_sesion_id IS NULL THEN
      RAISE EXCEPTION 'actividad_pt_id y sesion_id son obligatorios.';
    END IF;
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'No tienes grupo de tutoría asignado.'; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.sesiones s
      WHERE s.id = v_sesion_id AND s.asignacion_id = v_asig_id AND s.actividad_pt_id = v_actividad_id
    ) THEN
      RAISE EXCEPTION 'Sesión o actividad no válida para tu grupo.';
    END IF;

    IF v_evidencia_id IS NULL THEN
      SELECT ev.id INTO v_evidencia_id
      FROM public.evidencias ev
      WHERE ev.sesion_id = v_sesion_id AND ev.tutorado_id = v_uid
      LIMIT 1;
    END IF;

    IF v_evidencia_id IS NOT NULL THEN
      UPDATE public.evidencias SET
        archivo_url       = nullif(p_datos->>'archivo_url', ''),
        archivo_nombre    = nullif(p_datos->>'archivo_nombre', ''),
        archivo_tipo      = nullif(p_datos->>'archivo_tipo', ''),
        archivo_tamano_kb = nullif(p_datos->>'archivo_tamano_kb', '')::INTEGER,
        comentario_alumno = nullif(trim(p_datos->>'comentario_alumno'), ''),
        estado            = 'entregada',
        fecha_entrega     = NOW(),
        version           = version + 1
      WHERE id = v_evidencia_id AND tutorado_id = v_uid;
    ELSE
      INSERT INTO public.evidencias (
        actividad_pt_id, tutorado_id, periodo_id, sesion_id,
        archivo_url, archivo_nombre, archivo_tipo, archivo_tamano_kb,
        comentario_alumno, estado, fecha_entrega
      ) VALUES (
        v_actividad_id, v_uid, v_periodo_id, v_sesion_id,
        nullif(p_datos->>'archivo_url', ''),
        nullif(p_datos->>'archivo_nombre', ''),
        nullif(p_datos->>'archivo_tipo', ''),
        nullif(p_datos->>'archivo_tamano_kb', '')::INTEGER,
        nullif(trim(p_datos->>'comentario_alumno'), ''),
        'entregada', NOW()
      )
      RETURNING id INTO v_evidencia_id;
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Evidencia entregada', 'evidencia_id', v_evidencia_id);

  ELSE RAISE EXCEPTION 'Acción no válida: %', p_accion;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_evidencias_tutorado(TEXT, JSONB) TO authenticated;


CREATE OR REPLACE FUNCTION public.gestionar_seguimiento_tutor(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_asig_id     UUID;
  v_tutorado_id UUID;
  v_periodo_id  UUID;
  v_result      JSONB;
  v_total_ses   INTEGER;
  v_asist_ok    INTEGER;
  v_act_req     INTEGER;
  v_act_cal     INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;

  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);
  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  CASE lower(trim(p_accion))

  WHEN 'listar_grupo' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r)::JSONB ORDER BY r.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT
        p.id AS tutorado_id,
        p.nombre_completo,
        p.numero_control,
        p.carrera,
        (
          SELECT COUNT(*) FROM public.sesiones s
          WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
        ) AS total_sesiones,
        (
          SELECT COUNT(*) FROM public.sesiones s
          JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = p.id
          WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
        ) AS asistencias_registradas,
        (
          SELECT COUNT(*) FROM public.sesiones s
          JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id AND ap.requiere_evidencia = TRUE
          WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
        ) AS actividades_con_evidencia,
        (
          SELECT COUNT(*) FROM public.sesiones s
          JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id AND ap.requiere_evidencia = TRUE
          JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = p.id
            AND ev.estado = 'aceptada' AND ev.calificacion IS NOT NULL
          WHERE s.asignacion_id = v_asig_id
        ) AS actividades_calificadas,
        (
          SELECT ROUND(AVG(ev.calificacion)::NUMERIC, 2)
          FROM public.evidencias ev
          WHERE ev.tutorado_id = p.id AND ev.calificacion IS NOT NULL
            AND ev.estado = 'aceptada'
            AND (v_periodo_id IS NULL OR ev.periodo_id = v_periodo_id)
        ) AS promedio_calificaciones
      FROM public.asignaciones_tutorado att
      JOIN public.perfiles p ON p.id = att.tutorado_id
      WHERE att.asignacion_id = v_asig_id AND att.activa = TRUE
    ) r;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result, 'asignacion_id', v_asig_id);

  WHEN 'reporte_intermedio' THEN
    v_tutorado_id := (p_datos->>'tutorado_id')::UUID;
    IF v_tutorado_id IS NULL THEN RAISE EXCEPTION 'tutorado_id obligatorio.'; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado att
      WHERE att.tutorado_id = v_tutorado_id AND att.asignacion_id = v_asig_id AND att.activa = TRUE
    ) THEN RAISE EXCEPTION 'Tutorado no pertenece a tu grupo.'; END IF;

    SELECT COUNT(*) INTO v_total_ses
    FROM public.sesiones s WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL;

    SELECT COUNT(*) INTO v_asist_ok
    FROM public.sesiones s
    JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = v_tutorado_id
    WHERE s.asignacion_id = v_asig_id;

    SELECT COUNT(*) INTO v_act_req
    FROM public.sesiones s
    JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id AND ap.requiere_evidencia = TRUE
    WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL;

    SELECT COUNT(*) INTO v_act_cal
    FROM public.sesiones s
    JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id AND ap.requiere_evidencia = TRUE
    JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = v_tutorado_id
      AND ev.estado = 'aceptada' AND ev.calificacion IS NOT NULL
    WHERE s.asignacion_id = v_asig_id;

    SELECT jsonb_build_object(
      'ok', TRUE,
      'tipo_reporte', 'intermedio',
      'puede_cerrar_semestre', (v_asist_ok >= v_total_ses AND v_act_cal >= v_act_req AND v_act_req > 0),
      'resumen', jsonb_build_object(
        'total_sesiones', v_total_ses,
        'asistencias_registradas', v_asist_ok,
        'actividades_requieren_evidencia', v_act_req,
        'actividades_calificadas', v_act_cal,
        'promedio_calificaciones', (
          SELECT ROUND(AVG(ev.calificacion)::NUMERIC, 2)
          FROM public.evidencias ev
          WHERE ev.tutorado_id = v_tutorado_id AND ev.estado = 'aceptada' AND ev.calificacion IS NOT NULL
        )
      ),
      'tutorado', (
        SELECT row_to_json(t)::JSONB FROM (
          SELECT p.nombre_completo, p.numero_control, p.carrera, p.correo_institucional
          FROM public.perfiles p WHERE p.id = v_tutorado_id
        ) t
      ),
      'grupo', (
        SELECT row_to_json(g)::JSONB FROM (
          SELECT at2.carrera, at2.grupo, at2.dia_semana, at2.hora_inicio, at2.salon,
                 at2.semestre_generacional, pe.nombre AS periodo_nombre,
                 pt.nombre_completo AS tutor_nombre
          FROM public.asignaciones_tutor at2
          JOIN public.periodos_escolares pe ON pe.id = at2.periodo_id
          JOIN public.perfiles pt ON pt.id = at2.tutor_id
          WHERE at2.id = v_asig_id
        ) g
      ),
      'sesiones', (
        SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB)
        FROM (
          SELECT s.numero_sesion, s.fecha_realizada, ap.nombre AS actividad_nombre,
                 ap.requiere_evidencia,
                 a.estado AS asistencia_estado,
                 ev.estado AS evidencia_estado,
                 ev.calificacion,
                 ev.archivo_nombre,
                 ev.retroalimentacion,
                 public.fn_fecha_limite_grupo(ap.id, v_asig_id) AS fecha_limite_vigente
          FROM public.sesiones s
          LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
          LEFT JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = v_tutorado_id
          LEFT JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = v_tutorado_id
          WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
        ) s
      )
    ) INTO v_result;
    RETURN v_result;

  ELSE RAISE EXCEPTION 'Acción no válida: %', p_accion;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gestionar_seguimiento_tutor(TEXT, JSONB) TO authenticated;
