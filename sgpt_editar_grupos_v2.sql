-- ============================================================
-- SGPT — Editar grupos, sesiones, fechas por grupo, fix actividades PT
-- Ejecutar después de sgpt_sesiones_8_semestre.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_upsert_actividad_grupo(
  p_asignacion_id UUID,
  p_actividad_pt_id UUID,
  p_fecha_limite DATE,
  p_fecha_prog DATE,
  p_uid UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actividad_pt_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.actividades_grupo (
    actividad_pt_id, asignacion_id, fecha_limite_evidencia, fecha_programada_grupo, actualizado_por
  ) VALUES (p_actividad_pt_id, p_asignacion_id, p_fecha_limite, p_fecha_prog, p_uid)
  ON CONFLICT (actividad_pt_id, asignacion_id) DO UPDATE SET
    fecha_limite_evidencia = COALESCE(EXCLUDED.fecha_limite_evidencia, actividades_grupo.fecha_limite_evidencia),
    fecha_programada_grupo = COALESCE(EXCLUDED.fecha_programada_grupo, actividades_grupo.fecha_programada_grupo),
    actualizado_por = p_uid,
    actualizado_en = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_aplicar_sesiones_grupo(
  p_asignacion_id UUID,
  p_sesiones JSONB,
  p_uid UUID,
  p_validar_ocho BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elem JSONB;
  v_sesion_id UUID;
  v_act_id UUID;
  v_fecha_limite DATE;
BEGIN
  IF p_validar_ocho AND jsonb_array_length(COALESCE(p_sesiones, '[]'::JSONB)) <> 8 THEN
    RAISE EXCEPTION 'Debes mantener exactamente 8 sesiones en el semestre.';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_sesiones, '[]'::JSONB))
  LOOP
    v_sesion_id := nullif(v_elem->>'id', '')::UUID;
    v_act_id := nullif(v_elem->>'actividad_pt_id', '')::UUID;
    v_fecha_limite := nullif(v_elem->>'fecha_limite_grupo', '')::DATE;

    IF v_sesion_id IS NOT NULL THEN
      UPDATE public.sesiones SET
        fecha_realizada = COALESCE((v_elem->>'fecha_realizada')::DATE, fecha_realizada),
        actividad_pt_id = v_act_id
      WHERE id = v_sesion_id AND asignacion_id = p_asignacion_id;
    END IF;

    IF v_act_id IS NOT NULL THEN
      PERFORM public.fn_upsert_actividad_grupo(
        p_asignacion_id, v_act_id, v_fecha_limite,
        nullif(v_elem->>'fecha_realizada', '')::DATE, p_uid
      );
    END IF;
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
  v_sesion_id UUID;
  v_act_id UUID;
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
    v_act_id := nullif(v_elem->>'actividad_pt_id', '')::UUID;
    INSERT INTO public.sesiones (
      asignacion_id, actividad_pt_id, fecha_realizada, numero_sesion, creado_por
    ) VALUES (
      p_asignacion_id,
      v_act_id,
      (v_elem->>'fecha_realizada')::DATE,
      (v_elem->>'numero_sesion')::SMALLINT,
      p_creado_por
    ) RETURNING id INTO v_sesion_id;

    IF v_act_id IS NOT NULL THEN
      PERFORM public.fn_upsert_actividad_grupo(
        p_asignacion_id, v_act_id,
        nullif(v_elem->>'fecha_limite_grupo', '')::DATE,
        (v_elem->>'fecha_realizada')::DATE,
        p_creado_por
      );
    END IF;
  END LOOP;

  UPDATE public.asignaciones_tutor
  SET sesiones_planificadas = TRUE, actualizado_en = NOW()
  WHERE id = p_asignacion_id;
END;
$$;

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
  v_prog_id UUID; v_act_id UUID; v_nombre TEXT; v_result JSONB;
  v_estado estado_actividad; v_tipos TEXT[];
  v_req BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
    RAISE EXCEPTION 'Solo el Coordinador Institucional puede gestionar actividades del PT.';
  END IF;

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
    v_prog_id := (p_datos->>'programa_id')::UUID;
    v_nombre := trim(p_datos->>'nombre');
    v_req := coalesce((p_datos->>'requiere_evidencia')::BOOLEAN, FALSE);
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
      RAISE EXCEPTION 'Ya existe una actividad con ese nombre en esta fase.';
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
      auth.uid(), 'activa'
    ) RETURNING id INTO v_act_id;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Actividad registrada', 'actividad_id', v_act_id);

  WHEN 'actualizar' THEN
    v_act_id := (p_datos->>'actividad_id')::UUID;
    IF v_act_id IS NULL THEN RAISE EXCEPTION 'actividad_id obligatorio.'; END IF;
    v_req := coalesce((p_datos->>'requiere_evidencia')::BOOLEAN, FALSE);
    IF p_datos ? 'tipo_archivo_aceptado' AND jsonb_typeof(p_datos->'tipo_archivo_aceptado') = 'array' THEN
      v_tipos := ARRAY(SELECT jsonb_array_elements_text(p_datos->'tipo_archivo_aceptado'));
    END IF;
    UPDATE public.actividades_pt SET
      nombre = coalesce(nullif(trim(p_datos->>'nombre'), ''), nombre),
      descripcion = coalesce(nullif(trim(p_datos->>'descripcion'), ''), descripcion),
      tipo_sesion = coalesce((p_datos->>'tipo_sesion')::tipo_sesion, tipo_sesion),
      fase = coalesce((p_datos->>'fase')::fase_pt, fase),
      fecha_programada = coalesce((p_datos->>'fecha_programada')::DATE, fecha_programada),
      requiere_evidencia = v_req,
      tipo_archivo_aceptado = CASE WHEN v_tipos IS NOT NULL THEN v_tipos ELSE tipo_archivo_aceptado END,
      fecha_limite_evidencia = coalesce(nullif(p_datos->>'fecha_limite_evidencia', '')::DATE, fecha_limite_evidencia),
      actualizado_en = NOW()
    WHERE id = v_act_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Actividad actualizada');

  WHEN 'cambiar_estado' THEN
    v_act_id := (p_datos->>'actividad_id')::UUID;
    v_estado := (p_datos->>'estado')::estado_actividad;
    IF v_act_id IS NULL OR v_estado IS NULL THEN RAISE EXCEPTION 'actividad_id y estado obligatorios.'; END IF;
    UPDATE public.actividades_pt SET estado = v_estado, actualizado_en = NOW() WHERE id = v_act_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Estado actualizado', 'estado', v_estado);

  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
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

  WHEN 'obtener_detalle' THEN
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'asignacion_id obligatorio.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;
    SELECT jsonb_build_object(
      'ok', TRUE,
      'grupo', (
        SELECT row_to_json(g)::JSONB FROM (
          SELECT at2.id, at2.carrera, at2.grupo, at2.semestre_generacional, at2.dia_semana,
                 at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo, at2.sesiones_planificadas,
                 pe.nombre AS periodo_nombre
          FROM public.asignaciones_tutor at2
          JOIN public.periodos_escolares pe ON pe.id = at2.periodo_id
          WHERE at2.id = v_asig_id
        ) g
      ),
      'sesiones', (
        SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB)
        FROM (
          SELECT s.id, s.numero_sesion, s.fecha_realizada, s.actividad_pt_id, s.cerrada,
                 ap.nombre AS actividad_nombre, ap.requiere_evidencia,
                 ap.fecha_limite_evidencia AS fecha_limite_oficial,
                 ag.fecha_limite_evidencia AS fecha_limite_grupo,
                 ag.fecha_programada_grupo,
                 public.fn_fecha_limite_grupo(ap.id, v_asig_id) AS fecha_limite_vigente
          FROM public.sesiones s
          LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
          LEFT JOIN public.actividades_grupo ag ON ag.actividad_pt_id = ap.id AND ag.asignacion_id = v_asig_id
          WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
        ) s
      )
    ) INTO v_result;
    RETURN v_result;

  WHEN 'actualizar_grupo' THEN
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'asignacion_id obligatorio.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;
    v_hora_inicio := coalesce((p_datos->>'hora_inicio')::TIME, (SELECT hora_inicio FROM public.asignaciones_tutor WHERE id = v_asig_id));
    v_hora_fin := v_hora_inicio + INTERVAL '1 hour';
    UPDATE public.asignaciones_tutor SET
      carrera = coalesce(nullif(trim(p_datos->>'carrera'), ''), carrera),
      grupo = coalesce(nullif(trim(p_datos->>'grupo'), ''), grupo),
      semestre_generacional = coalesce(nullif(trim(p_datos->>'semestre_generacional'), ''), semestre_generacional),
      dia_semana = coalesce(nullif(trim(p_datos->>'dia_semana'), ''), dia_semana),
      hora_inicio = v_hora_inicio,
      hora_fin = v_hora_fin,
      salon = coalesce(nullif(trim(p_datos->>'salon'), ''), salon),
      cupo_maximo = coalesce((p_datos->>'cupo_maximo')::INTEGER, cupo_maximo),
      actualizado_en = NOW()
    WHERE id = v_asig_id;
    IF p_datos ? 'sesiones' THEN
      PERFORM public.fn_aplicar_sesiones_grupo(v_asig_id, p_datos->'sesiones', v_uid, TRUE);
    END IF;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Grupo actualizado correctamente.');

  WHEN 'eliminar_grupo' THEN
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'asignacion_id obligatorio.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;
    UPDATE public.asignaciones_tutor SET activa = FALSE, actualizado_en = NOW() WHERE id = v_asig_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Grupo desactivado.');

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
    IF p_datos->'sesiones' IS NULL THEN RAISE EXCEPTION 'Debes planificar 8 sesiones semanales.'; END IF;
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
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Grupo y 8 sesiones creados.', 'asignacion_id', v_asig_id);

  WHEN 'resumen' THEN
    IF v_asig_id IS NULL THEN
      SELECT at2.id INTO v_asig_id FROM public.asignaciones_tutor at2
      WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
        AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
      ORDER BY at2.creado_en DESC LIMIT 1;
    END IF;
    IF v_asig_id IS NULL THEN RETURN jsonb_build_object('ok', TRUE, 'sin_grupos', TRUE); END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN RAISE EXCEPTION 'Grupo no válido.'; END IF;
    SELECT cupo_maximo INTO v_cupo FROM public.asignaciones_tutor WHERE id = v_asig_id;
    v_actual := public.fn_conteo_tutorados_grupo(v_asig_id);
    SELECT jsonb_build_object(
      'ok', TRUE, 'asignacion_id', v_asig_id, 'cupo_maximo', v_cupo,
      'tutorados_asignados', v_actual, 'cupo_disponible', GREATEST(v_cupo - v_actual, 0),
      'sesiones_planificadas', (SELECT sesiones_planificadas FROM public.asignaciones_tutor WHERE id = v_asig_id),
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
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado desasignado del grupo.');

  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
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
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;
  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);

  CASE lower(trim(p_accion))
  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(x)::JSONB ORDER BY x.fecha_programada), '[]'::JSONB) INTO v_result
    FROM (
      SELECT ap.id, ap.nombre, ap.fase, ap.tipo_sesion, ap.fecha_programada,
             ap.fecha_limite_evidencia AS fecha_limite_oficial,
             ag.fecha_limite_evidencia AS fecha_limite_grupo,
             ag.fecha_programada_grupo,
             public.fn_fecha_limite_grupo(ap.id, v_asig_id) AS fecha_limite_vigente,
             ap.requiere_evidencia, ap.estado,
             (ag.actividad_pt_id IS NOT NULL) AS personalizada_grupo
      FROM public.actividades_pt ap
      LEFT JOIN public.actividades_grupo ag ON ag.actividad_pt_id = ap.id AND ag.asignacion_id = v_asig_id
      WHERE ap.estado = 'activa'
    ) x;
    RETURN jsonb_build_object('ok', TRUE, 'actividades', v_result, 'asignacion_id', v_asig_id);

  WHEN 'actualizar_fecha' THEN
    v_act_id := (p_datos->>'actividad_pt_id')::UUID;
    IF v_act_id IS NULL THEN RAISE EXCEPTION 'actividad_pt_id obligatorio.'; END IF;
    PERFORM public.fn_upsert_actividad_grupo(
      v_asig_id, v_act_id,
      nullif(p_datos->>'fecha_limite_evidencia', '')::DATE,
      nullif(p_datos->>'fecha_programada_grupo', '')::DATE,
      v_uid
    );
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Fechas del grupo actualizadas.');

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
    'periodo_nombre', (SELECT nombre FROM public.periodos_escolares WHERE id = v_periodo_id),
    'grupo', (
      SELECT row_to_json(g)::JSONB FROM (
        SELECT at2.id AS asignacion_id, at2.carrera, at2.grupo, at2.semestre_generacional,
               at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo,
               pt.nombre_completo AS tutor_nombre, pt.correo_institucional AS tutor_correo,
               pe.nombre AS periodo_nombre
        FROM public.asignaciones_tutor at2
        JOIN public.perfiles pt ON pt.id = at2.tutor_id
        JOIN public.periodos_escolares pe ON pe.id = at2.periodo_id
        WHERE at2.id = v_asig_id
      ) g
    ),
    'sesiones', (
      SELECT COALESCE(jsonb_agg(row_to_json(s)::JSONB ORDER BY s.numero_sesion), '[]'::JSONB)
      FROM (
        SELECT s.id, s.numero_sesion, s.fecha_realizada, s.cerrada,
               s.actividad_pt_id, ap.nombre AS actividad_nombre, ap.descripcion AS actividad_descripcion,
               ap.requiere_evidencia, ap.tipo_archivo_aceptado,
               ap.fecha_limite_evidencia AS fecha_limite_oficial,
               ag.fecha_limite_evidencia AS fecha_limite_grupo,
               public.fn_fecha_limite_grupo(ap.id, v_asig_id) AS fecha_limite_vigente,
               a.estado AS asistencia_estado,
               ev.id AS evidencia_id, ev.estado AS evidencia_estado,
               ev.archivo_nombre, ev.calificacion, ev.retroalimentacion
        FROM public.sesiones s
        LEFT JOIN public.actividades_pt ap ON ap.id = s.actividad_pt_id
        LEFT JOIN public.actividades_grupo ag ON ag.actividad_pt_id = ap.id AND ag.asignacion_id = v_asig_id
        LEFT JOIN public.asistencias a ON a.sesion_id = s.id AND a.tutorado_id = v_uid
        LEFT JOIN public.evidencias ev ON ev.sesion_id = s.id AND ev.tutorado_id = v_uid
        WHERE s.asignacion_id = v_asig_id AND s.numero_sesion IS NOT NULL
      ) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_upsert_actividad_grupo(UUID, UUID, DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_aplicar_sesiones_grupo(UUID, JSONB, UUID, BOOLEAN) TO authenticated;
