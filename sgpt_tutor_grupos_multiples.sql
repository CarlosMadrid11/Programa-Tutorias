-- ============================================================
-- SGPT — Tutor: crear múltiples grupos y asignar tutorados
-- Ejecutar después de contexto.sql, sgpt_gestion_rpc.sql y sgpt_grupos_tutoria.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_asignacion_pertenece_tutor(p_asignacion_id UUID, p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.asignaciones_tutor at2
    WHERE at2.id = p_asignacion_id AND at2.tutor_id = p_tutor_id AND at2.activa = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_asignar_tutorado_a_grupo(
  p_tutorado_id   UUID,
  p_asignacion_id UUID,
  p_periodo_id    UUID,
  p_asignado_por  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupo   INTEGER;
  v_actual INTEGER;
  v_prev_asig UUID;
BEGIN
  IF NOT public.fn_asignacion_pertenece_tutor(p_asignacion_id, p_asignado_por) THEN
    RAISE EXCEPTION 'El grupo no pertenece a este tutor.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = p_tutorado_id AND p.rol = 'tutorado'
      AND (
        p.creado_por = p_asignado_por
        OR EXISTS (
          SELECT 1 FROM public.asignaciones_tutorado att
          JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
          WHERE att.tutorado_id = p.id AND at2.tutor_id = p_asignado_por AND att.activa = TRUE
        )
      )
  ) THEN
    RAISE EXCEPTION 'No puede asignar este tutorado.';
  END IF;

  SELECT cupo_maximo INTO v_cupo FROM public.asignaciones_tutor WHERE id = p_asignacion_id;
  v_actual := public.fn_conteo_tutorados_grupo(p_asignacion_id);

  SELECT att.asignacion_id INTO v_prev_asig
  FROM public.asignaciones_tutorado att
  WHERE att.tutorado_id = p_tutorado_id AND att.periodo_id = p_periodo_id AND att.activa = TRUE;

  IF v_prev_asig IS NOT NULL AND v_prev_asig = p_asignacion_id THEN
    RETURN;
  END IF;

  IF v_prev_asig IS NULL OR v_prev_asig != p_asignacion_id THEN
    IF v_actual >= v_cupo THEN
      RAISE EXCEPTION 'El grupo alcanzó el cupo máximo de % tutorados.', v_cupo;
    END IF;
  END IF;

  IF v_prev_asig IS NOT NULL THEN
    UPDATE public.asignaciones_tutorado
    SET asignacion_id = p_asignacion_id,
        asignado_por = p_asignado_por,
        fecha_asignacion = CURRENT_DATE,
        activa = TRUE
    WHERE tutorado_id = p_tutorado_id AND periodo_id = p_periodo_id;
  ELSE
    INSERT INTO public.asignaciones_tutorado (asignacion_id, tutorado_id, periodo_id, asignado_por)
    VALUES (p_asignacion_id, p_tutorado_id, p_periodo_id, p_asignado_por);
  END IF;
END;
$$;

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
  v_uid          UUID := auth.uid();
  v_asig_id      UUID;
  v_periodo_id   UUID;
  v_tutorado_id  UUID;
  v_cupo         INTEGER;
  v_actual       INTEGER;
  v_result       JSONB;
  v_hora_inicio  TIME;
  v_hora_fin     TIME;
  v_carrera      TEXT;
  v_grupo        TEXT;
  v_dia          TEXT;
  v_salon        TEXT;
  v_semestre     TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN
    RAISE EXCEPTION 'Solo tutores pueden gestionar grupos.';
  END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;
  v_asig_id := nullif(p_datos->>'asignacion_id', '')::UUID;

  CASE lower(trim(p_accion))

  WHEN 'listar_grupos' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(g)::JSONB ORDER BY g.creado_en DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.semestre_generacional,
             at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon,
             at2.cupo_maximo,
             public.fn_conteo_tutorados_grupo(at2.id) AS tutorados_asignados,
             GREATEST(at2.cupo_maximo - public.fn_conteo_tutorados_grupo(at2.id), 0) AS cupo_disponible,
             at2.creado_en
      FROM public.asignaciones_tutor at2
      WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
        AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
    ) g;
    RETURN jsonb_build_object('ok', TRUE, 'grupos', v_result, 'periodo_id', v_periodo_id);

  WHEN 'crear_grupo' THEN
    IF v_periodo_id IS NULL THEN
      RAISE EXCEPTION 'No hay periodo escolar activo.';
    END IF;
    v_carrera := trim(p_datos->>'carrera');
    v_grupo := trim(p_datos->>'grupo');
    v_dia := trim(p_datos->>'dia_semana');
    v_salon := coalesce(nullif(trim(p_datos->>'salon'), ''), 'Por asignar');
    v_semestre := coalesce(nullif(trim(p_datos->>'semestre_generacional'), ''), v_grupo);
    v_hora_inicio := (p_datos->>'hora_inicio')::TIME;
    IF v_carrera IS NULL OR v_carrera = '' THEN RAISE EXCEPTION 'Carrera obligatoria.'; END IF;
    IF v_grupo IS NULL OR v_grupo = '' THEN RAISE EXCEPTION 'Nombre de grupo obligatorio.'; END IF;
    IF v_dia IS NULL OR v_dia = '' THEN RAISE EXCEPTION 'Día de la semana obligatorio.'; END IF;
    IF v_hora_inicio IS NULL THEN RAISE EXCEPTION 'Hora de inicio obligatoria.'; END IF;
    v_hora_fin := v_hora_inicio + INTERVAL '1 hour';

    INSERT INTO public.asignaciones_tutor (
      periodo_id, tutor_id, carrera, semestre_generacional, grupo,
      dia_semana, hora_inicio, hora_fin, salon, asignado_por, cupo_maximo
    ) VALUES (
      v_periodo_id, v_uid, v_carrera, v_semestre, v_grupo,
      v_dia, v_hora_inicio, v_hora_fin::TIME, v_salon, v_uid,
      coalesce((p_datos->>'cupo_maximo')::INTEGER, 25)
    )
    RETURNING id INTO v_asig_id;

    SELECT row_to_json(g)::JSONB INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo
      FROM public.asignaciones_tutor at2 WHERE at2.id = v_asig_id
    ) g;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Grupo creado. Duración: 1 hora.', 'grupo', v_result);

  WHEN 'resumen' THEN
    IF v_asig_id IS NULL THEN
      SELECT at2.id INTO v_asig_id
      FROM public.asignaciones_tutor at2
      WHERE at2.tutor_id = v_uid AND at2.activa = TRUE
        AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
      ORDER BY at2.creado_en DESC LIMIT 1;
    END IF;
    IF v_asig_id IS NULL THEN
      RETURN jsonb_build_object('ok', TRUE, 'sin_grupos', TRUE, 'mensaje', 'Aún no tienes grupos. Crea uno para asignar tutorados.');
    END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN
      RAISE EXCEPTION 'Grupo no válido.';
    END IF;
    SELECT cupo_maximo INTO v_cupo FROM public.asignaciones_tutor WHERE id = v_asig_id;
    v_actual := public.fn_conteo_tutorados_grupo(v_asig_id);
    SELECT jsonb_build_object(
      'ok', TRUE, 'asignacion_id', v_asig_id, 'cupo_maximo', v_cupo,
      'tutorados_asignados', v_actual, 'cupo_disponible', GREATEST(v_cupo - v_actual, 0),
      'grupo', row_to_json(g)::JSONB
    ) INTO v_result
    FROM (
      SELECT at2.id, at2.carrera, at2.grupo, at2.semestre_generacional,
             at2.dia_semana, at2.hora_inicio, at2.hora_fin, at2.salon, at2.cupo_maximo
      FROM public.asignaciones_tutor at2 WHERE at2.id = v_asig_id
    ) g;
    RETURN v_result;

  WHEN 'listar_tutorados' THEN
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'asignacion_id obligatorio.'; END IF;
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN
      RAISE EXCEPTION 'Grupo no válido.';
    END IF;
    SELECT cupo_maximo INTO v_cupo FROM public.asignaciones_tutor WHERE id = v_asig_id;
    v_actual := public.fn_conteo_tutorados_grupo(v_asig_id);
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

  WHEN 'asignar_tutorado' THEN
    v_tutorado_id := (p_datos->>'tutorado_id')::UUID;
    IF v_asig_id IS NULL THEN RAISE EXCEPTION 'asignacion_id obligatorio.'; END IF;
    IF v_tutorado_id IS NULL THEN RAISE EXCEPTION 'tutorado_id obligatorio.'; END IF;
    IF v_periodo_id IS NULL THEN RAISE EXCEPTION 'No hay periodo activo.'; END IF;
    PERFORM public.fn_asignar_tutorado_a_grupo(v_tutorado_id, v_asig_id, v_periodo_id, v_uid);
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado asignado al grupo.');

  WHEN 'desasignar' THEN
    v_tutorado_id := (p_datos->>'tutorado_id')::UUID;
    IF v_asig_id IS NULL THEN
      SELECT att.asignacion_id INTO v_asig_id
      FROM public.asignaciones_tutorado att
      JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE att.tutorado_id = v_tutorado_id AND att.activa = TRUE
        AND at2.tutor_id = v_uid
        AND (v_periodo_id IS NULL OR att.periodo_id = v_periodo_id)
      LIMIT 1;
    END IF;
    IF v_tutorado_id IS NULL THEN RAISE EXCEPTION 'tutorado_id obligatorio.'; END IF;
    IF v_asig_id IS NULL OR NOT public.fn_asignacion_pertenece_tutor(v_asig_id, v_uid) THEN
      RAISE EXCEPTION 'Grupo no válido.';
    END IF;
    UPDATE public.asignaciones_tutorado SET activa = FALSE
    WHERE asignacion_id = v_asig_id AND tutorado_id = v_tutorado_id AND activa = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El tutorado no pertenece a ese grupo.'; END IF;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado desasignado del grupo.');

  ELSE
    RAISE EXCEPTION 'Acción no válida. Use listar_grupos, crear_grupo, resumen, listar_tutorados, asignar_tutorado o desasignar.';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gestionar_tutorados(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID;
  v_correo TEXT;
  v_nombre TEXT;
  v_control TEXT;
  v_carrera TEXT;
  v_telefono TEXT;
  v_password TEXT;
  v_perfil_id UUID;
  v_estado estado_registro;
  v_periodo_id UUID;
  v_asig_id UUID;
  v_result JSONB;
  v_asignar BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores pueden gestionar tutorados.'; END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;
  v_asig_id := nullif(p_datos->>'asignacion_id', '')::UUID;
  v_asignar := coalesce((p_datos->>'asignar_grupo')::BOOLEAN, v_asig_id IS NOT NULL);

  CASE lower(trim(p_accion))
  WHEN 'crear' THEN
    v_nombre := trim(p_datos->>'nombre_completo');
    v_control := upper(trim(regexp_replace(p_datos->>'numero_control', '^L', '', 'i')));
    v_carrera := nullif(trim(p_datos->>'carrera'), '');
    v_telefono := nullif(trim(p_datos->>'telefono'), '');
    v_password := coalesce(p_datos->>'password_temp', 'SgptTemp1!');
    IF v_nombre IS NULL OR v_nombre = '' THEN RAISE EXCEPTION 'Nombre obligatorio.'; END IF;
    IF v_control IS NULL OR v_control = '' THEN RAISE EXCEPTION 'Matrícula obligatoria.'; END IF;
    v_correo := lower('L' || v_control || '@culiacan.tecnm.mx');
    IF EXISTS (SELECT 1 FROM public.perfiles WHERE numero_control = v_control) THEN
      RAISE EXCEPTION 'El usuario ya existe en el sistema (matrícula duplicada).';
    END IF;

    v_uid := public.fn_auth_crear_usuario(v_correo, v_password, jsonb_build_object(
      'rol', 'tutorado', 'nombre_completo', v_nombre, 'numero_control', v_control,
      'carrera', v_carrera, 'telefono', v_telefono, 'creado_por', auth.uid()::TEXT
    ));

    UPDATE public.perfiles SET rol = 'tutorado', nombre_completo = v_nombre,
      correo_institucional = v_correo, numero_control = v_control, carrera = v_carrera,
      telefono = v_telefono, creado_por = auth.uid(), primer_acceso = TRUE,
      password_temporal = v_password, estado = 'activo'
    WHERE id = v_uid;

    IF v_asignar AND v_asig_id IS NOT NULL AND v_periodo_id IS NOT NULL THEN
      IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, auth.uid()) THEN
        RAISE EXCEPTION 'El grupo seleccionado no te pertenece.';
      END IF;
      PERFORM public.fn_asignar_tutorado_a_grupo(v_uid, v_asig_id, v_periodo_id, auth.uid());
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado registrado',
      'perfil_id', v_uid, 'correo', v_correo, 'numero_control', v_control,
      'password_temp', v_password, 'asignado_grupo', v_asignar AND v_asig_id IS NOT NULL,
      'asignacion_id', v_asig_id);

  WHEN 'actualizar' THEN
    v_perfil_id := (p_datos->>'perfil_id')::UUID;
    v_nombre := nullif(trim(p_datos->>'nombre_completo'), '');
    v_correo := nullif(lower(trim(p_datos->>'correo_institucional')), '');
    v_estado := nullif(p_datos->>'estado', '')::estado_registro;
    IF v_perfil_id IS NULL THEN RAISE EXCEPTION 'perfil_id obligatorio.'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.perfiles p WHERE p.id = v_perfil_id AND p.rol = 'tutorado'
        AND (p.creado_por = auth.uid() OR EXISTS (
          SELECT 1 FROM public.asignaciones_tutorado att
          JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
          WHERE att.tutorado_id = p.id AND at2.tutor_id = auth.uid() AND att.activa = TRUE))
    ) THEN RAISE EXCEPTION 'No puede editar este tutorado.'; END IF;
    IF v_correo IS NOT NULL AND NOT public.fn_validar_correo_rol(v_correo, 'tutorado') THEN
      RAISE EXCEPTION 'Correo inválido.';
    END IF;
    UPDATE public.perfiles SET
      nombre_completo = COALESCE(v_nombre, nombre_completo),
      correo_institucional = COALESCE(v_correo, correo_institucional),
      estado = COALESCE(v_estado, estado), actualizado_en = NOW()
    WHERE id = v_perfil_id;
    IF v_correo IS NOT NULL THEN UPDATE auth.users SET email = v_correo WHERE id = v_perfil_id; END IF;
    SELECT jsonb_build_object('ok', TRUE, 'mensaje', 'Actualizado', 'perfil', row_to_json(p)::JSONB)
    INTO v_result FROM public.perfiles p WHERE p.id = v_perfil_id;
    RETURN v_result;

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.nombre_completo), '[]'::JSONB) INTO v_result
    FROM (
      SELECT DISTINCT ON (p.id)
        p.id, p.nombre_completo, p.correo_institucional, p.numero_control,
        p.carrera, p.estado, p.primer_acceso, p.creado_en,
        CASE WHEN p.primer_acceso THEN p.password_temporal ELSE NULL END AS password_temporal,
        att.asignacion_id,
        at2.grupo AS grupo_codigo,
        at2.carrera AS grupo_carrera,
        at2.dia_semana AS grupo_dia,
        at2.hora_inicio AS grupo_hora,
        (att.id IS NOT NULL AND att.activa = TRUE) AS en_grupo,
        pt.nombre_completo AS tutor_grupo_nombre
      FROM public.perfiles p
      LEFT JOIN public.asignaciones_tutorado att
        ON att.tutorado_id = p.id AND att.activa = TRUE
        AND (v_periodo_id IS NULL OR att.periodo_id = v_periodo_id)
      LEFT JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id AND at2.tutor_id = auth.uid()
      LEFT JOIN public.perfiles pt ON pt.id = at2.tutor_id
      WHERE p.rol = 'tutorado'
        AND (
          p.creado_por = auth.uid()
          OR at2.tutor_id = auth.uid()
        )
      ORDER BY p.id, p.nombre_completo
    ) t;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result);

  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;

CREATE OR REPLACE VIEW public.v_relacion_tutor_tutorado AS
SELECT
  att.id AS relacion_id,
  att.tutorado_id,
  p_t.nombre_completo AS tutorado_nombre,
  p_t.numero_control,
  att.periodo_id,
  pe.nombre AS periodo_nombre,
  at2.id AS asignacion_id,
  at2.tutor_id,
  p_r.nombre_completo AS tutor_nombre,
  at2.carrera,
  at2.grupo,
  at2.dia_semana,
  at2.hora_inicio,
  at2.hora_fin,
  att.activa,
  att.fecha_asignacion,
  p_t.creado_por AS tutorado_registrado_por
FROM public.asignaciones_tutorado att
JOIN public.perfiles p_t ON p_t.id = att.tutorado_id
JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
JOIN public.perfiles p_r ON p_r.id = at2.tutor_id
JOIN public.periodos_escolares pe ON pe.id = att.periodo_id;

GRANT SELECT ON public.v_relacion_tutor_tutorado TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_asignacion_pertenece_tutor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_asignar_tutorado_a_grupo(UUID, UUID, UUID, UUID) TO authenticated;

COMMENT ON VIEW public.v_relacion_tutor_tutorado IS
  'Relación tutorado–tutor por periodo y grupo tutorial.';
COMMENT ON FUNCTION public.gestionar_grupo_tutor IS
  'Tutor: listar/crear grupos (1 h), asignar y desasignar tutorados.';

CREATE OR REPLACE FUNCTION public.fn_resolver_asignacion_tutor(p_datos JSONB, p_tutor_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asig_id UUID;
  v_periodo_id UUID;
BEGIN
  v_asig_id := nullif(p_datos->>'asignacion_id', '')::UUID;
  IF v_asig_id IS NOT NULL THEN
    IF NOT public.fn_asignacion_pertenece_tutor(v_asig_id, p_tutor_id) THEN
      RAISE EXCEPTION 'Grupo no válido.';
    END IF;
    RETURN v_asig_id;
  END IF;
  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;
  SELECT at2.id INTO v_asig_id
  FROM public.asignaciones_tutor at2
  WHERE at2.tutor_id = p_tutor_id AND at2.activa = TRUE
    AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
  ORDER BY at2.creado_en DESC LIMIT 1;
  IF v_asig_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona un grupo o crea uno en Registrar tutorados.';
  END IF;
  RETURN v_asig_id;
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

  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);

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
    RETURN jsonb_build_object('ok', TRUE, 'sesiones', v_result, 'asignacion_id', v_asig_id);
  WHEN 'listar_matriz' THEN
    v_sesion_id := (p_datos->>'sesion_id')::UUID;
    IF v_sesion_id IS NULL THEN RAISE EXCEPTION 'sesion_id obligatorio.'; END IF;
    SELECT cerrada INTO v_cerrada FROM public.sesiones WHERE id = v_sesion_id AND asignacion_id = v_asig_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no encontrada en tu grupo.'; END IF;
    SELECT COALESCE(jsonb_agg(row_to_json(m)::JSONB ORDER BY m.nombre_completo), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT p.id AS tutorado_id, p.nombre_completo, p.numero_control,
             COALESCE(a.estado::TEXT, 'presente') AS estado, a.observaciones
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
      estado = EXCLUDED.estado, capturado_por = v_uid, fecha_captura = NOW();
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Asistencia registrada correctamente.');
  WHEN 'crear_sesion' THEN
    INSERT INTO public.sesiones (asignacion_id, actividad_pt_id, fecha_realizada, creado_por)
    VALUES (v_asig_id, nullif(p_datos->>'actividad_pt_id', '')::UUID, (p_datos->>'fecha_realizada')::DATE, v_uid)
    RETURNING id INTO v_sesion_id;
    RETURN jsonb_build_object('ok', TRUE, 'sesion_id', v_sesion_id, 'mensaje', 'Sesión creada.');
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
  v_fecha_limite DATE;
  v_fecha_prog DATE;
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
             ap.requiere_evidencia, ap.estado
      FROM public.actividades_pt ap
      LEFT JOIN public.actividades_grupo ag ON ag.actividad_pt_id = ap.id AND ag.asignacion_id = v_asig_id
      WHERE ap.estado = 'activa' ORDER BY ap.fecha_programada
    ) x;
    RETURN jsonb_build_object('ok', TRUE, 'actividades', v_result, 'asignacion_id', v_asig_id);
  WHEN 'actualizar_fecha' THEN
    v_act_id := (p_datos->>'actividad_pt_id')::UUID;
    v_fecha_limite := nullif(p_datos->>'fecha_limite_evidencia', '')::DATE;
    v_fecha_prog := nullif(p_datos->>'fecha_programada_grupo', '')::DATE;
    IF v_act_id IS NULL THEN RAISE EXCEPTION 'actividad_pt_id obligatorio.'; END IF;
    INSERT INTO public.actividades_grupo (actividad_pt_id, asignacion_id, fecha_limite_evidencia, fecha_programada_grupo, actualizado_por)
    VALUES (v_act_id, v_asig_id, v_fecha_limite, v_fecha_prog, v_uid)
    ON CONFLICT (actividad_pt_id, asignacion_id) DO UPDATE SET
      fecha_limite_evidencia = COALESCE(EXCLUDED.fecha_limite_evidencia, actividades_grupo.fecha_limite_evidencia),
      fecha_programada_grupo = COALESCE(EXCLUDED.fecha_programada_grupo, actividades_grupo.fecha_programada_grupo),
      actualizado_por = v_uid, actualizado_en = NOW();
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Fechas actualizadas solo para tu grupo.');
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
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores.'; END IF;
  v_asig_id := public.fn_resolver_asignacion_tutor(p_datos, v_uid);
  CASE lower(trim(p_accion))
  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(e)::JSONB ORDER BY e.fecha_entrega DESC), '[]'::JSONB) INTO v_result
    FROM (
      SELECT ev.id, ev.estado, ev.retroalimentacion, ev.comentario_alumno,
             ev.archivo_nombre, ev.archivo_url, ev.fecha_entrega,
             p.nombre_completo AS tutorado_nombre, p.numero_control, ap.nombre AS actividad_nombre
      FROM public.evidencias ev
      JOIN public.perfiles p ON p.id = ev.tutorado_id
      JOIN public.actividades_pt ap ON ap.id = ev.actividad_pt_id
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE att.asignacion_id = v_asig_id
    ) e;
    RETURN jsonb_build_object('ok', TRUE, 'evidencias', v_result, 'asignacion_id', v_asig_id);
  WHEN 'evaluar' THEN
    v_evidencia_id := (p_datos->>'evidencia_id')::UUID;
    v_estado := (p_datos->>'estado')::estado_evidencia;
    v_retro := nullif(trim(p_datos->>'retroalimentacion'), '');
    IF v_evidencia_id IS NULL OR v_estado IS NULL THEN RAISE EXCEPTION 'evidencia_id y estado obligatorios.'; END IF;
    IF v_estado IN ('requiere_correccion', 'rechazada') AND v_retro IS NULL THEN
      RAISE EXCEPTION 'Retroalimentación obligatoria para corrección o rechazo.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.evidencias ev
      JOIN public.asignaciones_tutorado att ON att.tutorado_id = ev.tutorado_id AND att.activa = TRUE
      WHERE ev.id = v_evidencia_id AND att.asignacion_id = v_asig_id
    ) THEN RAISE EXCEPTION 'No puede evaluar evidencias ajenas a su grupo.'; END IF;
    UPDATE public.evidencias SET estado = v_estado, retroalimentacion = v_retro,
      evaluada_por = v_uid, fecha_evaluacion = NOW() WHERE id = v_evidencia_id;
    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Evidencia evaluada.');
  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;
