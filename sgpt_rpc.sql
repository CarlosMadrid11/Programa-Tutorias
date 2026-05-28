-- ============================================================
-- SGPT — Actualizaciones RPC, Vistas y Funciones Adicionales
-- Ejecutar en el SQL Editor de Supabase DESPUÉS del contexto.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. ACTUALIZAR TRIGGER de creación de perfil
--    Ahora lee todos los campos del metadata
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_crear_perfil_nuevo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol rol_usuario;
BEGIN
  v_rol := COALESCE((NEW.raw_user_meta_data->>'rol')::rol_usuario, 'tutorado');

  INSERT INTO public.perfiles (
    id,
    rol,
    nombre_completo,
    correo_institucional,
    numero_empleado,
    numero_control,
    telefono,
    departamento,
    carrera,
    estado,
    primer_acceso,
    creado_por
  )
  VALUES (
    NEW.id,
    v_rol,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Sin nombre'),
    NEW.email,
    NEW.raw_user_meta_data->>'numero_empleado',
    NEW.raw_user_meta_data->>'numero_control',
    NEW.raw_user_meta_data->>'telefono',
    NEW.raw_user_meta_data->>'departamento',
    NEW.raw_user_meta_data->>'carrera',
    'activo',
    TRUE,
    (NEW.raw_user_meta_data->>'creado_por')::UUID
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Volver a crear el trigger (reemplaza el existente)
DROP TRIGGER IF EXISTS trg_crear_perfil_usuario ON auth.users;
CREATE TRIGGER trg_crear_perfil_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_crear_perfil_nuevo_usuario();


-- ------------------------------------------------------------
-- 2. FUNCIÓN RPC: Porcentaje de asistencia de un tutorado
--    Usada en ConsultarTutorados y en acreditaciones
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_porcentaje_asistencia(
  p_tutorado_id UUID,
  p_periodo_id  UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total    INTEGER;
  v_presentes INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.asistencias a
  JOIN public.sesiones s ON s.id = a.sesion_id
  JOIN public.asignaciones_tutor at2 ON at2.id = s.asignacion_id
  WHERE a.tutorado_id = p_tutorado_id
    AND at2.periodo_id = p_periodo_id;

  IF v_total = 0 THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_presentes
  FROM public.asistencias a
  JOIN public.sesiones s ON s.id = a.sesion_id
  JOIN public.asignaciones_tutor at2 ON at2.id = s.asignacion_id
  WHERE a.tutorado_id = p_tutorado_id
    AND at2.periodo_id = p_periodo_id
    AND a.estado IN ('presente', 'justificado');

  RETURN ROUND((v_presentes::NUMERIC / v_total) * 100, 1);
END;
$$;


-- ------------------------------------------------------------
-- 3. VISTA: Resumen de tutorados por periodo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_resumen_tutorado AS
SELECT
  p.id                                AS tutorado_id,
  p.nombre_completo,
  p.numero_control,
  p.carrera,
  p.estado,
  per.id                              AS periodo_id,
  per.nombre                          AS periodo_nombre,
  tp.nombre_completo                  AS tutor_nombre,
  at2.carrera                         AS carrera_grupo,
  at2.grupo,
  (
    SELECT COUNT(*) FROM public.asistencias a
    JOIN public.sesiones s ON s.id = a.sesion_id
    WHERE a.tutorado_id = p.id AND s.asignacion_id = att.asignacion_id
  )                                   AS total_sesiones,
  (
    SELECT COUNT(*) FROM public.asistencias a
    JOIN public.sesiones s ON s.id = a.sesion_id
    WHERE a.tutorado_id = p.id AND s.asignacion_id = att.asignacion_id
      AND a.estado IN ('presente','justificado')
  )                                   AS sesiones_presentes,
  (
    SELECT COUNT(*) FROM public.evidencias ev
    WHERE ev.tutorado_id = p.id AND ev.periodo_id = per.id
      AND ev.estado IN ('entregada','aceptada')
  )                                   AS evidencias_entregadas,
  (
    SELECT MAX(e.calificacion_final) FROM public.evaluaciones e
    WHERE e.tutorado_id = p.id AND e.periodo_id = per.id AND e.tipo = 'final'
  )                                   AS calificacion_final,
  (
    SELECT e.estado_tutorado FROM public.evaluaciones e
    WHERE e.tutorado_id = p.id AND e.periodo_id = per.id
    ORDER BY e.creado_en DESC LIMIT 1
  )                                   AS estado_acreditacion
FROM public.perfiles p
JOIN public.asignaciones_tutorado att ON att.tutorado_id = p.id AND att.activa = TRUE
JOIN public.asignaciones_tutor at2    ON at2.id = att.asignacion_id
JOIN public.periodos_escolares per    ON per.id = at2.periodo_id
JOIN public.perfiles tp               ON tp.id  = at2.tutor_id
WHERE p.rol = 'tutorado'
  AND p.estado = 'activo';


-- ------------------------------------------------------------
-- 4. VISTA: Resumen de tutores con métricas
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_resumen_tutor AS
SELECT
  p.id                                AS tutor_id,
  p.nombre_completo,
  p.correo_institucional,
  p.departamento,
  per.id                              AS periodo_id,
  per.nombre                          AS periodo_nombre,
  at2.carrera,
  at2.grupo,
  at2.dia_semana,
  at2.hora_inicio,
  at2.salon,
  (
    SELECT COUNT(*) FROM public.asignaciones_tutorado att
    WHERE att.asignacion_id = at2.id AND att.activa = TRUE
  )                                   AS total_tutorados,
  (
    SELECT COUNT(*) FROM public.sesiones s
    WHERE s.asignacion_id = at2.id
  )                                   AS sesiones_realizadas,
  (
    SELECT COUNT(*) FROM public.evaluaciones e
    JOIN public.asignaciones_tutorado att ON att.tutorado_id = e.tutorado_id
    WHERE att.asignacion_id = at2.id AND e.tipo = 'final'
  )                                   AS evaluaciones_finales
FROM public.perfiles p
JOIN public.asignaciones_tutor at2 ON at2.tutor_id = p.id AND at2.activa = TRUE
JOIN public.periodos_escolares per ON per.id = at2.periodo_id
WHERE p.rol = 'tutor'
  AND p.estado = 'activo';


-- ------------------------------------------------------------
-- 5. POLÍTICA RLS: Coordinadores pueden ver todos los perfiles
--    (la política base solo permite ver el propio)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "perfiles_ver_coordinadores" ON public.perfiles;
CREATE POLICY "perfiles_ver_coordinadores"
  ON public.perfiles FOR SELECT
  USING (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional',
      'coordinador_departamental',
      'jefe_departamento',
      'jefe_desarrollo_academico',
      'director',
      'subdirector'
    ]::rol_usuario[])
  );

-- Los tutores pueden ver sus propios tutorados
DROP POLICY IF EXISTS "perfiles_ver_tutor" ON public.perfiles;
CREATE POLICY "perfiles_ver_tutor"
  ON public.perfiles FOR SELECT
  USING (
    public.fn_tiene_rol('tutor') AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado att
      JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE att.tutorado_id = perfiles.id
        AND at2.tutor_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- 6. POLÍTICA: El Coordinador Institucional puede crear perfiles
--    (INSERT en perfiles vía trigger de auth, pero update para
--    completar campos después de que el trigger los crea)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "perfiles_update_coordinador" ON public.perfiles;
CREATE POLICY "perfiles_update_coordinador"
  ON public.perfiles FOR UPDATE
  USING (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional',
      'jefe_desarrollo_academico'
    ]::rol_usuario[])
  );

-- Cada usuario puede actualizar su propio perfil (contraseña temporal, etc.)
DROP POLICY IF EXISTS "perfiles_update_propio" ON public.perfiles;
CREATE POLICY "perfiles_update_propio"
  ON public.perfiles FOR UPDATE
  USING (id = auth.uid());


-- ------------------------------------------------------------
-- 7. POLÍTICAS PARA ASIGNACIONES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "asig_tutor_ver" ON public.asignaciones_tutor;
CREATE POLICY "asig_tutor_ver"
  ON public.asignaciones_tutor FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','coordinador_departamental',
      'jefe_departamento','jefe_desarrollo_academico','director','subdirector'
    ]::rol_usuario[])
  );

DROP POLICY IF EXISTS "asig_tutor_insert" ON public.asignaciones_tutor;
CREATE POLICY "asig_tutor_insert"
  ON public.asignaciones_tutor FOR INSERT
  WITH CHECK (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','jefe_departamento'
    ]::rol_usuario[])
  );

DROP POLICY IF EXISTS "asig_tutor_update" ON public.asignaciones_tutor;
CREATE POLICY "asig_tutor_update"
  ON public.asignaciones_tutor FOR UPDATE
  USING (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','jefe_departamento'
    ]::rol_usuario[])
  );

DROP POLICY IF EXISTS "asig_tutorado_ver" ON public.asignaciones_tutorado;
CREATE POLICY "asig_tutorado_ver"
  ON public.asignaciones_tutorado FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at2
      WHERE at2.id = asignaciones_tutorado.asignacion_id
        AND at2.tutor_id = auth.uid()
    )
    OR public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','coordinador_departamental',
      'jefe_departamento','jefe_desarrollo_academico'
    ]::rol_usuario[])
  );

DROP POLICY IF EXISTS "asig_tutorado_insert" ON public.asignaciones_tutorado;
CREATE POLICY "asig_tutorado_insert"
  ON public.asignaciones_tutorado FOR INSERT
  WITH CHECK (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','coordinador_departamental'
    ]::rol_usuario[])
  );


-- ------------------------------------------------------------
-- 8. POLÍTICAS PARA ACTIVIDADES PT
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "act_pt_ver" ON public.actividades_pt;
CREATE POLICY "act_pt_ver"
  ON public.actividades_pt FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "act_pt_insert" ON public.actividades_pt;
CREATE POLICY "act_pt_insert"
  ON public.actividades_pt FOR INSERT
  WITH CHECK (public.fn_tiene_rol('coordinador_institucional'));

DROP POLICY IF EXISTS "act_pt_update" ON public.actividades_pt;
CREATE POLICY "act_pt_update"
  ON public.actividades_pt FOR UPDATE
  USING (
    public.fn_tiene_rol('coordinador_institucional')
    OR (public.fn_tiene_rol('tutor') AND bloqueada_modificacion = FALSE)
  );


-- ------------------------------------------------------------
-- 9. POLÍTICAS PARA SESIONES Y ASISTENCIAS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "sesiones_ver" ON public.sesiones;
CREATE POLICY "sesiones_ver"
  ON public.sesiones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at2
      WHERE at2.id = sesiones.asignacion_id
        AND (at2.tutor_id = auth.uid() OR public.fn_tiene_alguno_de_los_roles(ARRAY['coordinador_institucional','coordinador_departamental','jefe_departamento']::rol_usuario[]))
    )
    OR EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado att
      JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE at2.id = sesiones.asignacion_id AND att.tutorado_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sesiones_insert" ON public.sesiones;
CREATE POLICY "sesiones_insert"
  ON public.sesiones FOR INSERT
  WITH CHECK (
    public.fn_tiene_rol('tutor') AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutor at2
      WHERE at2.id = NEW.asignacion_id AND at2.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "asistencias_ver" ON public.asistencias;
CREATE POLICY "asistencias_ver"
  ON public.asistencias FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR capturado_por = auth.uid()
    OR public.fn_tiene_alguno_de_los_roles(ARRAY['coordinador_institucional','coordinador_departamental','jefe_departamento']::rol_usuario[])
  );

DROP POLICY IF EXISTS "asistencias_insert" ON public.asistencias;
CREATE POLICY "asistencias_insert"
  ON public.asistencias FOR INSERT
  WITH CHECK (public.fn_tiene_rol('tutor'));

DROP POLICY IF EXISTS "asistencias_update" ON public.asistencias;
CREATE POLICY "asistencias_update"
  ON public.asistencias FOR UPDATE
  USING (public.fn_tiene_rol('tutor') AND capturado_por = auth.uid());


-- ------------------------------------------------------------
-- 10. POLÍTICAS PARA EVIDENCIAS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "evidencias_ver" ON public.evidencias;
CREATE POLICY "evidencias_ver"
  ON public.evidencias FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado att
      JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE att.tutorado_id = evidencias.tutorado_id AND at2.tutor_id = auth.uid()
    )
    OR public.fn_tiene_alguno_de_los_roles(ARRAY['coordinador_institucional','coordinador_departamental','jefe_departamento']::rol_usuario[])
  );

DROP POLICY IF EXISTS "evidencias_insert" ON public.evidencias;
CREATE POLICY "evidencias_insert"
  ON public.evidencias FOR INSERT
  WITH CHECK (public.fn_tiene_rol('tutorado') AND tutorado_id = auth.uid());

DROP POLICY IF EXISTS "evidencias_update" ON public.evidencias;
CREATE POLICY "evidencias_update"
  ON public.evidencias FOR UPDATE
  USING (
    tutorado_id = auth.uid()
    OR (public.fn_tiene_rol('tutor') AND EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado att
      JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE att.tutorado_id = evidencias.tutorado_id AND at2.tutor_id = auth.uid()
    ))
  );


-- ------------------------------------------------------------
-- 11. POLÍTICAS PARA EVALUACIONES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "evaluaciones_ver" ON public.evaluaciones;
CREATE POLICY "evaluaciones_ver"
  ON public.evaluaciones FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR evaluado_por = auth.uid()
    OR public.fn_tiene_alguno_de_los_roles(ARRAY['coordinador_institucional','coordinador_departamental','jefe_departamento']::rol_usuario[])
  );

DROP POLICY IF EXISTS "evaluaciones_insert" ON public.evaluaciones;
CREATE POLICY "evaluaciones_insert"
  ON public.evaluaciones FOR INSERT
  WITH CHECK (public.fn_tiene_rol('tutor') AND evaluado_por = auth.uid());

DROP POLICY IF EXISTS "evaluaciones_update" ON public.evaluaciones;
CREATE POLICY "evaluaciones_update"
  ON public.evaluaciones FOR UPDATE
  USING (public.fn_tiene_rol('tutor') AND evaluado_por = auth.uid());


-- ------------------------------------------------------------
-- 12. POLÍTICAS PARA ACREDITACIONES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "acreditaciones_ver" ON public.acreditaciones;
CREATE POLICY "acreditaciones_ver"
  ON public.acreditaciones FOR SELECT
  USING (
    tutorado_id = auth.uid()
    OR public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','coordinador_departamental',
      'jefe_departamento','tutor','director','subdirector'
    ]::rol_usuario[])
  );

DROP POLICY IF EXISTS "acreditaciones_insert" ON public.acreditaciones;
CREATE POLICY "acreditaciones_insert"
  ON public.acreditaciones FOR INSERT
  WITH CHECK (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','coordinador_departamental','jefe_departamento','tutor'
    ]::rol_usuario[])
  );

DROP POLICY IF EXISTS "acreditaciones_update" ON public.acreditaciones;
CREATE POLICY "acreditaciones_update"
  ON public.acreditaciones FOR UPDATE
  USING (
    public.fn_tiene_alguno_de_los_roles(ARRAY[
      'coordinador_institucional','coordinador_departamental','jefe_departamento','tutor'
    ]::rol_usuario[])
  );


-- ------------------------------------------------------------
-- 13. POLÍTICAS PARA PERIODOS, PROGRAMAS, ALERTAS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "periodos_ver" ON public.periodos_escolares;
CREATE POLICY "periodos_ver"
  ON public.periodos_escolares FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "periodos_manage" ON public.periodos_escolares;
CREATE POLICY "periodos_manage"
  ON public.periodos_escolares FOR ALL
  USING (public.fn_tiene_rol('coordinador_institucional'));

DROP POLICY IF EXISTS "programas_ver" ON public.programas_tutorias;
CREATE POLICY "programas_ver"
  ON public.programas_tutorias FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "programas_manage" ON public.programas_tutorias;
CREATE POLICY "programas_manage"
  ON public.programas_tutorias FOR ALL
  USING (public.fn_tiene_rol('coordinador_institucional'));

DROP POLICY IF EXISTS "alertas_ver" ON public.alertas_sistema;
CREATE POLICY "alertas_ver"
  ON public.alertas_sistema FOR SELECT
  USING (
    tutor_id = auth.uid()
    OR public.fn_tiene_alguno_de_los_roles(ARRAY['coordinador_institucional','coordinador_departamental','jefe_departamento']::rol_usuario[])
  );

DROP POLICY IF EXISTS "it_ver" ON public.it_culiacan;
CREATE POLICY "it_ver"
  ON public.it_culiacan FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ------------------------------------------------------------
-- 14. STORAGE: Bucket para evidencias
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias',
  'evidencias',
  TRUE,
  10485760,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/gif','video/mp4']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "evidencias_storage_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'evidencias'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "evidencias_storage_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidencias' AND auth.uid() IS NOT NULL);


-- ------------------------------------------------------------
-- 15. PERÍODO DE PRUEBA: Insertar período activo si no existe
-- ------------------------------------------------------------
INSERT INTO public.periodos_escolares (nombre, fecha_inicio, fecha_fin, activo)
SELECT 'Enero-Junio 2026', '2026-01-13', '2026-06-30', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.periodos_escolares WHERE activo = TRUE);
