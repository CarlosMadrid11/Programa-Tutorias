-- ============================================================
-- SGPT — RPC consolidadas de gestión de usuarios y tutorados
-- Ejecutar en Supabase SQL Editor DESPUÉS de contexto.sql y sgpt_rpc.sql
-- ============================================================

-- ------------------------------------------------------------
-- Helper: crear usuario en auth.users (SECURITY DEFINER)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_auth_crear_usuario(
  p_email       TEXT,
  p_password    TEXT,
  p_meta        JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := gen_random_uuid();
  v_encrypted TEXT;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'El correo es obligatorio.';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña temporal debe tener al menos 8 caracteres.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'El correo ya está registrado en el sistema.';
  END IF;

  v_encrypted := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    v_encrypted,
    NOW(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    COALESCE(p_meta, '{}'::JSONB),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    v_uid,
    jsonb_build_object('sub', v_uid::TEXT, 'email', lower(trim(p_email))),
    'email',
    v_uid::TEXT,
    NOW(),
    NOW(),
    NOW()
  );

  RETURN v_uid;
END;
$$;

-- ------------------------------------------------------------
-- Helper: validar dominio de correo según rol
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_correo_rol(
  p_correo TEXT,
  p_rol    rol_usuario
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_rol = 'tutorado' THEN
    RETURN lower(p_correo) ~ '^l[0-9a-z]+@culiacan\.tecnm\.mx$';
  END IF;
  RETURN lower(p_correo) LIKE '%@itculiacan.edu.mx'
      OR lower(p_correo) LIKE '%@culiacan.tecnm.mx';
END;
$$;

-- ------------------------------------------------------------
-- RPC: gestionar_usuarios_admin
-- Acciones: crear | actualizar | listar
-- Solo coordinador_institucional
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gestionar_usuarios_admin(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid           UUID;
  v_rol           rol_usuario;
  v_correo        TEXT;
  v_nombre        TEXT;
  v_num_emp       TEXT;
  v_depto         TEXT;
  v_carrera       TEXT;
  v_telefono      TEXT;
  v_password      TEXT;
  v_perfil_id     UUID;
  v_estado        estado_registro;
  v_existente     UUID;
  v_result        JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida.';
  END IF;

  IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
    RAISE EXCEPTION 'No tiene permisos. Solo el Coordinador Institucional puede gestionar usuarios.';
  END IF;

  CASE lower(trim(p_accion))

  -- ── CREAR ──────────────────────────────────────────────
  WHEN 'crear' THEN
    v_nombre   := trim(p_datos->>'nombre_completo');
    v_correo   := lower(trim(p_datos->>'correo_institucional'));
    v_rol      := (p_datos->>'rol')::rol_usuario;
    v_num_emp  := upper(trim(p_datos->>'numero_empleado'));
    v_depto    := nullif(trim(p_datos->>'departamento'), '');
    v_carrera  := nullif(trim(p_datos->>'carrera'), '');
    v_telefono := nullif(trim(p_datos->>'telefono'), '');
    v_password := coalesce(p_datos->>'password_temp', 'SgptTemp1!');

    IF v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'El nombre completo es obligatorio.';
    END IF;
    IF v_correo IS NULL OR v_correo = '' THEN
      RAISE EXCEPTION 'El correo institucional es obligatorio.';
    END IF;
    IF v_rol IS NULL OR v_rol = 'tutorado' THEN
      RAISE EXCEPTION 'Use gestionar_tutorados para dar de alta tutorados.';
    END IF;
    IF v_num_emp IS NULL OR v_num_emp = '' THEN
      RAISE EXCEPTION 'El número de empleado es obligatorio.';
    END IF;
    IF NOT public.fn_validar_correo_rol(v_correo, v_rol) THEN
      RAISE EXCEPTION 'Correo inválido para el rol. Personal: dominio @itculiacan.edu.mx';
    END IF;

    IF EXISTS (SELECT 1 FROM public.perfiles WHERE numero_empleado = v_num_emp) THEN
      RAISE EXCEPTION 'El usuario ya existe en el sistema (número de empleado duplicado).';
    END IF;
    IF EXISTS (SELECT 1 FROM public.perfiles WHERE lower(correo_institucional) = v_correo) THEN
      RAISE EXCEPTION 'El correo ya está registrado en el sistema.';
    END IF;

    v_uid := public.fn_auth_crear_usuario(
      v_correo,
      v_password,
      jsonb_build_object(
        'rol', v_rol::TEXT,
        'nombre_completo', v_nombre,
        'numero_empleado', v_num_emp,
        'departamento', v_depto,
        'carrera', v_carrera,
        'telefono', v_telefono,
        'creado_por', auth.uid()::TEXT
      )
    );

    UPDATE public.perfiles SET
      rol                  = v_rol,
      nombre_completo      = v_nombre,
      correo_institucional = v_correo,
      numero_empleado      = v_num_emp,
      departamento         = v_depto,
      carrera              = v_carrera,
      telefono             = v_telefono,
      creado_por           = auth.uid(),
      primer_acceso        = TRUE,
      estado               = 'activo'
    WHERE id = v_uid;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'mensaje', 'Usuario registrado exitosamente',
      'perfil_id', v_uid,
      'correo', v_correo,
      'numero_empleado', v_num_emp,
      'password_temp', v_password
    );

  -- ── ACTUALIZAR (nombre, correo, estado) ────────────────
  WHEN 'actualizar' THEN
    v_perfil_id := (p_datos->>'perfil_id')::UUID;
    v_nombre    := nullif(trim(p_datos->>'nombre_completo'), '');
    v_correo    := nullif(lower(trim(p_datos->>'correo_institucional')), '');
    v_estado    := nullif(p_datos->>'estado', '')::estado_registro;

    IF v_perfil_id IS NULL THEN
      RAISE EXCEPTION 'perfil_id es obligatorio.';
    END IF;

    SELECT rol INTO v_rol FROM public.perfiles WHERE id = v_perfil_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Usuario no encontrado.';
    END IF;
    IF v_rol = 'tutorado' THEN
      RAISE EXCEPTION 'Para tutorados use gestionar_tutorados.';
    END IF;

    IF v_correo IS NOT NULL AND NOT public.fn_validar_correo_rol(v_correo, v_rol) THEN
      RAISE EXCEPTION 'Correo inválido para este rol.';
    END IF;

    IF v_correo IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE lower(correo_institucional) = v_correo AND id != v_perfil_id
    ) THEN
      RAISE EXCEPTION 'El correo ya está en uso por otro usuario.';
    END IF;

    UPDATE public.perfiles SET
      nombre_completo      = COALESCE(v_nombre, nombre_completo),
      correo_institucional = COALESCE(v_correo, correo_institucional),
      estado               = COALESCE(v_estado, estado),
      actualizado_en       = NOW()
    WHERE id = v_perfil_id;

    IF v_correo IS NOT NULL THEN
      UPDATE auth.users SET email = v_correo, updated_at = NOW() WHERE id = v_perfil_id;
    END IF;

    SELECT jsonb_build_object(
      'ok', TRUE,
      'mensaje', 'Usuario actualizado correctamente',
      'perfil', row_to_json(p)::JSONB
    ) INTO v_result
    FROM public.perfiles p WHERE p.id = v_perfil_id;

    RETURN v_result;

  -- ── LISTAR (excluye tutorados) ─────────────────────────
  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.creado_en DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT id, nombre_completo, correo_institucional, rol,
             numero_empleado, departamento, carrera, estado, creado_en
      FROM public.perfiles
      WHERE rol != 'tutorado'
      ORDER BY creado_en DESC
    ) t;

    RETURN jsonb_build_object('ok', TRUE, 'usuarios', v_result);

  ELSE
    RAISE EXCEPTION 'Acción no válida: %. Use crear, actualizar o listar.', p_accion;
  END CASE;
END;
$$;

-- ------------------------------------------------------------
-- RPC: gestionar_tutorados
-- Acciones: crear | actualizar | listar
-- Solo tutor (crea/modifica tutorados de su ámbito)
-- ------------------------------------------------------------
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
  v_uid           UUID;
  v_correo        TEXT;
  v_nombre        TEXT;
  v_control       TEXT;
  v_carrera       TEXT;
  v_telefono      TEXT;
  v_password      TEXT;
  v_perfil_id     UUID;
  v_estado        estado_registro;
  v_periodo_id    UUID;
  v_asig_id       UUID;
  v_result        JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida.';
  END IF;

  IF NOT public.fn_tiene_rol('tutor') THEN
    RAISE EXCEPTION 'No tiene permisos. Solo los tutores pueden gestionar tutorados.';
  END IF;

  SELECT id INTO v_periodo_id
  FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;

  SELECT at2.id INTO v_asig_id
  FROM public.asignaciones_tutor at2
  WHERE at2.tutor_id = auth.uid()
    AND at2.activa = TRUE
    AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
  ORDER BY at2.creado_en DESC
  LIMIT 1;

  CASE lower(trim(p_accion))

  WHEN 'crear' THEN
    v_nombre   := trim(p_datos->>'nombre_completo');
    v_control  := upper(trim(regexp_replace(p_datos->>'numero_control', '^L', '', 'i')));
    v_carrera  := nullif(trim(p_datos->>'carrera'), '');
    v_telefono := nullif(trim(p_datos->>'telefono'), '');
    v_password := coalesce(p_datos->>'password_temp', 'SgptTemp1!');

    IF v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'El nombre completo es obligatorio.';
    END IF;
    IF v_control IS NULL OR v_control = '' THEN
      RAISE EXCEPTION 'El número de control (matrícula) es obligatorio.';
    END IF;

    v_correo := lower('L' || v_control || '@culiacan.tecnm.mx');

    IF EXISTS (SELECT 1 FROM public.perfiles WHERE numero_control = v_control) THEN
      RAISE EXCEPTION 'El usuario ya existe en el sistema (matrícula duplicada).';
    END IF;
    IF EXISTS (SELECT 1 FROM public.perfiles WHERE lower(correo_institucional) = v_correo) THEN
      RAISE EXCEPTION 'El correo derivado de la matrícula ya está registrado.';
    END IF;

    v_uid := public.fn_auth_crear_usuario(
      v_correo,
      v_password,
      jsonb_build_object(
        'rol', 'tutorado',
        'nombre_completo', v_nombre,
        'numero_control', v_control,
        'carrera', v_carrera,
        'telefono', v_telefono,
        'creado_por', auth.uid()::TEXT
      )
    );

    UPDATE public.perfiles SET
      rol                  = 'tutorado',
      nombre_completo      = v_nombre,
      correo_institucional = v_correo,
      numero_control       = v_control,
      carrera              = v_carrera,
      telefono             = v_telefono,
      creado_por           = auth.uid(),
      primer_acceso        = TRUE,
      estado               = 'activo'
    WHERE id = v_uid;

    -- Asignar automáticamente al grupo del tutor si tiene asignación activa
    IF v_asig_id IS NOT NULL AND v_periodo_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.asignaciones_tutorado
        WHERE tutorado_id = v_uid AND periodo_id = v_periodo_id AND activa = TRUE
      ) THEN
        INSERT INTO public.asignaciones_tutorado (
          asignacion_id, tutorado_id, periodo_id, asignado_por
        ) VALUES (
          v_asig_id, v_uid, v_periodo_id, auth.uid()
        );
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'mensaje', 'Tutorado registrado exitosamente',
      'perfil_id', v_uid,
      'correo', v_correo,
      'numero_control', v_control,
      'password_temp', v_password,
      'asignado_grupo', v_asig_id IS NOT NULL
    );

  WHEN 'actualizar' THEN
    v_perfil_id := (p_datos->>'perfil_id')::UUID;
    v_nombre    := nullif(trim(p_datos->>'nombre_completo'), '');
    v_correo    := nullif(lower(trim(p_datos->>'correo_institucional')), '');
    v_estado    := nullif(p_datos->>'estado', '')::estado_registro;

    IF v_perfil_id IS NULL THEN
      RAISE EXCEPTION 'perfil_id es obligatorio.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.perfiles p
      WHERE p.id = v_perfil_id AND p.rol = 'tutorado'
        AND (
          p.creado_por = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.asignaciones_tutorado att
            JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
            WHERE att.tutorado_id = p.id AND at2.tutor_id = auth.uid() AND att.activa = TRUE
          )
        )
    ) THEN
      RAISE EXCEPTION 'No puede editar este tutorado.';
    END IF;

    IF v_correo IS NOT NULL AND NOT public.fn_validar_correo_rol(v_correo, 'tutorado') THEN
      RAISE EXCEPTION 'Correo inválido. Formato: L{matrícula}@culiacan.tecnm.mx';
    END IF;

    UPDATE public.perfiles SET
      nombre_completo      = COALESCE(v_nombre, nombre_completo),
      correo_institucional = COALESCE(v_correo, correo_institucional),
      estado               = COALESCE(v_estado, estado),
      actualizado_en       = NOW()
    WHERE id = v_perfil_id;

    IF v_correo IS NOT NULL THEN
      UPDATE auth.users SET email = v_correo, updated_at = NOW() WHERE id = v_perfil_id;
    END IF;

    SELECT jsonb_build_object(
      'ok', TRUE,
      'mensaje', 'Tutorado actualizado correctamente',
      'perfil', row_to_json(p)::JSONB
    ) INTO v_result
    FROM public.perfiles p WHERE p.id = v_perfil_id;

    RETURN v_result;

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.nombre_completo), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT DISTINCT p.id, p.nombre_completo, p.correo_institucional,
             p.numero_control, p.carrera, p.estado, p.creado_en
      FROM public.perfiles p
      LEFT JOIN public.asignaciones_tutorado att ON att.tutorado_id = p.id AND att.activa = TRUE
      LEFT JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE p.rol = 'tutorado'
        AND (p.creado_por = auth.uid() OR at2.tutor_id = auth.uid())
      ORDER BY p.nombre_completo
    ) t;

    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result);

  ELSE
    RAISE EXCEPTION 'Acción no válida: %. Use crear, actualizar o listar.', p_accion;
  END CASE;
END;
$$;

-- ------------------------------------------------------------
-- Permisos de ejecución
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.gestionar_usuarios_admin(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_tutorados(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validar_correo_rol(TEXT, rol_usuario) TO authenticated;

COMMENT ON FUNCTION public.gestionar_usuarios_admin IS
  'CU-01/CP-01: Alta y edición de usuarios institucionales (coordinador_institucional).';
COMMENT ON FUNCTION public.gestionar_tutorados IS
  'Alta y edición de tutorados por el tutor asignado. Correo: L{control}@culiacan.tecnm.mx';

-- ============================================================
-- EXTENSIÓN: contraseña temporal, cambio inicial y actividades PT
-- ============================================================

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS password_temporal TEXT;

COMMENT ON COLUMN public.perfiles.password_temporal IS
  'Contraseña temporal visible solo mientras primer_acceso = TRUE. Se borra al cambiar contraseña.';

-- Helper validación contraseña (8+, número, especial)
CREATE OR REPLACE FUNCTION public.fn_validar_password_segura(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 8 THEN RETURN FALSE; END IF;
  IF p_password !~ '[0-9]' THEN RETURN FALSE; END IF;
  IF p_password !~ '[^A-Za-z0-9]' THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

-- RPC: cambiar contraseña en primer acceso
CREATE OR REPLACE FUNCTION public.cambiar_password_inicial(
  p_password_nueva        TEXT,
  p_password_confirmacion TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles WHERE id = v_uid AND primer_acceso = TRUE
  ) THEN
    RAISE EXCEPTION 'No requiere cambio de contraseña.';
  END IF;

  IF p_password_nueva IS NULL OR p_password_nueva <> p_password_confirmacion THEN
    RAISE EXCEPTION 'Las contraseñas no coinciden.';
  END IF;

  IF NOT public.fn_validar_password_segura(p_password_nueva) THEN
    RAISE EXCEPTION 'La contraseña debe tener mínimo 8 caracteres, un número y un carácter especial.';
  END IF;

  UPDATE auth.users SET
    encrypted_password = extensions.crypt(p_password_nueva, extensions.gen_salt('bf')),
    updated_at = NOW()
  WHERE id = v_uid;

  UPDATE public.perfiles SET
    primer_acceso = FALSE,
    password_temporal = NULL,
    actualizado_en = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Contraseña actualizada correctamente');
END;
$$;

-- Reemplazar gestionar_usuarios_admin (guardar password_temporal en crear + listar)
CREATE OR REPLACE FUNCTION public.gestionar_usuarios_admin(
  p_accion TEXT,
  p_datos  JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid UUID; v_rol rol_usuario; v_correo TEXT; v_nombre TEXT;
  v_num_emp TEXT; v_depto TEXT; v_carrera TEXT; v_telefono TEXT; v_password TEXT;
  v_perfil_id UUID; v_estado estado_registro; v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
    RAISE EXCEPTION 'No tiene permisos. Solo el Coordinador Institucional puede gestionar usuarios.';
  END IF;

  CASE lower(trim(p_accion))
  WHEN 'crear' THEN
    v_nombre := trim(p_datos->>'nombre_completo');
    v_correo := lower(trim(p_datos->>'correo_institucional'));
    v_rol := (p_datos->>'rol')::rol_usuario;
    v_num_emp := upper(trim(p_datos->>'numero_empleado'));
    v_depto := nullif(trim(p_datos->>'departamento'), '');
    v_carrera := nullif(trim(p_datos->>'carrera'), '');
    v_telefono := nullif(trim(p_datos->>'telefono'), '');
    v_password := coalesce(p_datos->>'password_temp', 'SgptTemp1!');

    IF v_nombre IS NULL OR v_nombre = '' THEN RAISE EXCEPTION 'El nombre completo es obligatorio.'; END IF;
    IF v_correo IS NULL OR v_correo = '' THEN RAISE EXCEPTION 'El correo institucional es obligatorio.'; END IF;
    IF v_rol IS NULL OR v_rol = 'tutorado' THEN RAISE EXCEPTION 'Use gestionar_tutorados para tutorados.'; END IF;
    IF v_num_emp IS NULL OR v_num_emp = '' THEN RAISE EXCEPTION 'El número de empleado es obligatorio.'; END IF;
    IF NOT public.fn_validar_correo_rol(v_correo, v_rol) THEN RAISE EXCEPTION 'Correo inválido para el rol.'; END IF;
    IF EXISTS (SELECT 1 FROM public.perfiles WHERE numero_empleado = v_num_emp) THEN
      RAISE EXCEPTION 'El usuario ya existe en el sistema (número de empleado duplicado).';
    END IF;
    IF EXISTS (SELECT 1 FROM public.perfiles WHERE lower(correo_institucional) = v_correo) THEN
      RAISE EXCEPTION 'El correo ya está registrado en el sistema.';
    END IF;

    v_uid := public.fn_auth_crear_usuario(v_correo, v_password, jsonb_build_object(
      'rol', v_rol::TEXT, 'nombre_completo', v_nombre, 'numero_empleado', v_num_emp,
      'departamento', v_depto, 'carrera', v_carrera, 'telefono', v_telefono, 'creado_por', auth.uid()::TEXT
    ));

    UPDATE public.perfiles SET
      rol = v_rol, nombre_completo = v_nombre, correo_institucional = v_correo,
      numero_empleado = v_num_emp, departamento = v_depto, carrera = v_carrera,
      telefono = v_telefono, creado_por = auth.uid(), primer_acceso = TRUE,
      password_temporal = v_password, estado = 'activo'
    WHERE id = v_uid;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Usuario registrado exitosamente',
      'perfil_id', v_uid, 'correo', v_correo, 'numero_empleado', v_num_emp, 'password_temp', v_password);

  WHEN 'actualizar' THEN
    v_perfil_id := (p_datos->>'perfil_id')::UUID;
    v_nombre := nullif(trim(p_datos->>'nombre_completo'), '');
    v_correo := nullif(lower(trim(p_datos->>'correo_institucional')), '');
    v_estado := nullif(p_datos->>'estado', '')::estado_registro;
    IF v_perfil_id IS NULL THEN RAISE EXCEPTION 'perfil_id es obligatorio.'; END IF;
    SELECT rol INTO v_rol FROM public.perfiles WHERE id = v_perfil_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;
    IF v_rol = 'tutorado' THEN RAISE EXCEPTION 'Para tutorados use gestionar_tutorados.'; END IF;
    IF v_correo IS NOT NULL AND NOT public.fn_validar_correo_rol(v_correo, v_rol) THEN RAISE EXCEPTION 'Correo inválido.'; END IF;
    IF v_correo IS NOT NULL AND EXISTS (SELECT 1 FROM public.perfiles WHERE lower(correo_institucional) = v_correo AND id != v_perfil_id) THEN
      RAISE EXCEPTION 'El correo ya está en uso.';
    END IF;
    UPDATE public.perfiles SET
      nombre_completo = COALESCE(v_nombre, nombre_completo),
      correo_institucional = COALESCE(v_correo, correo_institucional),
      estado = COALESCE(v_estado, estado), actualizado_en = NOW()
    WHERE id = v_perfil_id;
    IF v_correo IS NOT NULL THEN UPDATE auth.users SET email = v_correo, updated_at = NOW() WHERE id = v_perfil_id; END IF;
    SELECT jsonb_build_object('ok', TRUE, 'mensaje', 'Usuario actualizado', 'perfil', row_to_json(p)::JSONB)
    INTO v_result FROM public.perfiles p WHERE p.id = v_perfil_id;
    RETURN v_result;

  WHEN 'listar' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.creado_en DESC), '[]'::JSONB) INTO v_result
    FROM (
      SELECT id, nombre_completo, correo_institucional, rol, numero_empleado,
             departamento, carrera, estado, primer_acceso, creado_en,
             CASE WHEN primer_acceso THEN password_temporal ELSE NULL END AS password_temporal
      FROM public.perfiles WHERE rol != 'tutorado' ORDER BY creado_en DESC
    ) t;
    RETURN jsonb_build_object('ok', TRUE, 'usuarios', v_result);
  ELSE
    RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;

-- Reemplazar gestionar_tutorados (password_temporal)
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
  v_uid UUID; v_correo TEXT; v_nombre TEXT; v_control TEXT; v_carrera TEXT; v_telefono TEXT;
  v_password TEXT; v_perfil_id UUID; v_estado estado_registro;
  v_periodo_id UUID; v_asig_id UUID; v_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('tutor') THEN RAISE EXCEPTION 'Solo tutores pueden gestionar tutorados.'; END IF;

  SELECT id INTO v_periodo_id FROM public.periodos_escolares WHERE activo = TRUE LIMIT 1;
  SELECT at2.id INTO v_asig_id FROM public.asignaciones_tutor at2
  WHERE at2.tutor_id = auth.uid() AND at2.activa = TRUE
    AND (v_periodo_id IS NULL OR at2.periodo_id = v_periodo_id)
  ORDER BY at2.creado_en DESC LIMIT 1;

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

    IF v_asig_id IS NOT NULL AND v_periodo_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.asignaciones_tutorado WHERE tutorado_id = v_uid AND periodo_id = v_periodo_id AND activa = TRUE
    ) THEN
      INSERT INTO public.asignaciones_tutorado (asignacion_id, tutorado_id, periodo_id, asignado_por)
      VALUES (v_asig_id, v_uid, v_periodo_id, auth.uid());
    END IF;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Tutorado registrado',
      'perfil_id', v_uid, 'correo', v_correo, 'numero_control', v_control,
      'password_temp', v_password, 'asignado_grupo', v_asig_id IS NOT NULL);

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
      SELECT DISTINCT p.id, p.nombre_completo, p.correo_institucional, p.numero_control,
             p.carrera, p.estado, p.primer_acceso, p.creado_en,
             CASE WHEN p.primer_acceso THEN p.password_temporal ELSE NULL END AS password_temporal
      FROM public.perfiles p
      LEFT JOIN public.asignaciones_tutorado att ON att.tutorado_id = p.id AND att.activa = TRUE
      LEFT JOIN public.asignaciones_tutor at2 ON at2.id = att.asignacion_id
      WHERE p.rol = 'tutorado' AND (p.creado_por = auth.uid() OR at2.tutor_id = auth.uid())
      ORDER BY p.nombre_completo
    ) t;
    RETURN jsonb_build_object('ok', TRUE, 'tutorados', v_result);
  ELSE RAISE EXCEPTION 'Acción no válida.';
  END CASE;
END;
$$;

-- RPC: gestionar_actividades_pt (CP-08)
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida.'; END IF;
  IF NOT public.fn_tiene_rol('coordinador_institucional') THEN
    RAISE EXCEPTION 'Solo el Coordinador Institucional puede gestionar actividades del PT.';
  END IF;

  CASE lower(trim(p_accion))
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
    IF v_prog_id IS NULL OR v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'programa_id y nombre son obligatorios.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.actividades_pt ap
      JOIN public.programas_tutorias pt ON pt.id = ap.programa_id
      WHERE ap.programa_id = v_prog_id AND lower(ap.nombre) = lower(v_nombre)
        AND ap.fase = (p_datos->>'fase')::fase_pt
    ) THEN
      RAISE EXCEPTION 'Ya existe una actividad con ese nombre en esta fase y periodo.';
    END IF;

    IF (p_datos->>'requiere_evidencia')::BOOLEAN THEN
      v_tipos := ARRAY(SELECT jsonb_array_elements_text(p_datos->'tipo_archivo_aceptado'));
    END IF;

    INSERT INTO public.actividades_pt (
      programa_id, nombre, descripcion, tipo_sesion, fase, fecha_programada,
      requiere_evidencia, tipo_archivo_aceptado, fecha_limite_evidencia, creado_por
    ) VALUES (
      v_prog_id, v_nombre, nullif(p_datos->>'descripcion', ''),
      (p_datos->>'tipo_sesion')::tipo_sesion, (p_datos->>'fase')::fase_pt,
      (p_datos->>'fecha_programada')::DATE,
      coalesce((p_datos->>'requiere_evidencia')::BOOLEAN, FALSE),
      v_tipos,
      nullif(p_datos->>'fecha_limite_evidencia', '')::DATE,
      auth.uid()
    ) RETURNING id INTO v_act_id;

    RETURN jsonb_build_object('ok', TRUE, 'mensaje', 'Actividad registrada', 'actividad_id', v_act_id);

  WHEN 'actualizar' THEN
    v_act_id := (p_datos->>'actividad_id')::UUID;
    IF v_act_id IS NULL THEN RAISE EXCEPTION 'actividad_id obligatorio.'; END IF;
    IF (p_datos->>'requiere_evidencia')::BOOLEAN THEN
      v_tipos := ARRAY(SELECT jsonb_array_elements_text(p_datos->'tipo_archivo_aceptado'));
    END IF;
    UPDATE public.actividades_pt SET
      nombre = coalesce(nullif(trim(p_datos->>'nombre'), ''), nombre),
      descripcion = coalesce(nullif(p_datos->>'descripcion', ''), descripcion),
      tipo_sesion = coalesce((p_datos->>'tipo_sesion')::tipo_sesion, tipo_sesion),
      fase = coalesce((p_datos->>'fase')::fase_pt, fase),
      fecha_programada = coalesce((p_datos->>'fecha_programada')::DATE, fecha_programada),
      requiere_evidencia = coalesce((p_datos->>'requiere_evidencia')::BOOLEAN, requiere_evidencia),
      tipo_archivo_aceptado = coalesce(v_tipos, tipo_archivo_aceptado),
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

  ELSE RAISE EXCEPTION 'Acción no válida. Use listar, crear, actualizar o cambiar_estado.';
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cambiar_password_inicial(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validar_password_segura(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_actividades_pt(TEXT, JSONB) TO authenticated;
