-- 2C ETAPA 1 — INFRAESTRUCTURA CORREGIDA. PROPUESTA MANUAL PARA REVISIÓN.
-- NO ejecutar desde frontend/CI. NO aplicada en Supabase.
-- SUSTITUYE a 01_infraestructura.sql: aplicar solo este archivo, nunca ambos.
-- 01 se conserva como documento histórico (tiene errores de sintaxis e integridad;
-- ver docs/firmas-2c-etapa1-correccion.md). Primera instalación, no idempotente.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $preflight$
DECLARE spec record; col text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('contratos',ARRAY['id','solicitud_id','folio','created_at','updated_at','arrendador_persona_moral_id','estado','unidad_id','fecha_inicio','fecha_fin','renta','deposito','dia_pago','fecha_firma','lugar_firma','costo_lavanderia','domicilio_arrendador','domicilio_arrendatario','domicilio_fiador']),
  ('documentos_contrato',ARRAY['id','contrato_id','version_plantilla_id','numero_version','tipo','estado','nombre_archivo','storage_path','datos_snapshot','contenido_renderizado','generated_at','created_at','updated_at']),
  ('partes_contrato',ARRAY['id','contrato_id','persona_id','persona_moral_id','rol']),
  ('personas',ARRAY['id','nombre','apellido_paterno','apellido_materno','rfc','curp']),
  ('personas_morales',ARRAY['id','razon_social']),
  ('representantes_persona_moral',ARRAY['id','persona_moral_id','persona_id','caracter','es_principal']),
  ('unidades',ARRAY['id','edificio_id']),('edificios',ARRAY['id']),('users',ARRAY['id','role']),
  ('versiones_plantilla',ARRAY['id','plantilla_id','numero_version','estado','contenido'])
 ) AS required(tab,cols) LOOP
  FOREACH col IN ARRAY spec.cols LOOP
   IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=spec.tab AND column_name=col) THEN
    RAISE EXCEPTION 'Falta columna requerida %.%',spec.tab,col;
   END IF;
  END LOOP;
 END LOOP;
 -- Supabase verificado: postgres tiene rolsuper=false y rolbypassrls=true.
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Instalar con propietario confiable BYPASSRLS/superusuario; SECURITY DEFINER por sí solo no elude RLS';
 END IF;
 IF current_user IN('anon','authenticated','service_role','authenticator') THEN RAISE EXCEPTION 'Rol de instalación no permitido'; END IF;
 -- Los triggers distinguen RPC de escritura directa por current_user=propietario: un rol cliente
 -- que pueda SET ROLE al propietario anularía esa distinción. Roles de operador (p. ej.
 -- cli_login_postgres) sí pueden ser miembros: son autoridad de mantenimiento.
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','authenticator']) r(rol)
  WHERE to_regrole(r.rol) IS NOT NULL AND pg_has_role(r.rol,current_user,'MEMBER')) THEN
  RAISE EXCEPTION 'Un rol cliente es miembro del rol instalador: no se instala';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN('contratos','partes_contrato','documentos_contrato','versiones_plantilla')
  AND pg_get_userbyid(c.relowner)<>current_user) THEN
  RAISE EXCEPTION 'El instalador debe ser propietario de contratos, partes, documentos y versiones de plantilla';
 END IF;
 IF to_regprocedure('auth.uid()') IS NULL THEN RAISE EXCEPTION 'Falta auth.uid()'; END IF;
 IF to_regprocedure('pg_catalog.sha256(bytea)') IS NULL THEN RAISE EXCEPTION 'Falta sha256(bytea) nativo'; END IF;
 -- Dependencia 2B.0: entidad XOR y triggers diferidos de arrendador habilitados.
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.partes_contrato'::regclass AND conname='partes_2b0_entidad_xor') THEN
  RAISE EXCEPTION 'Falta el CHECK partes_2b0_entidad_xor de 2B.0';
 END IF;
 IF (SELECT count(*) FROM pg_trigger
  WHERE ((tgrelid='public.contratos'::regclass AND tgname='contratos_2b0_integridad')
   OR (tgrelid='public.partes_contrato'::regclass AND tgname='partes_2b0_integridad'))
   AND tgdeferrable AND tginitdeferred AND tgenabled='O')<>2 THEN
  RAISE EXCEPTION 'Faltan los triggers diferidos habilitados de 2B.0';
 END IF;
 IF to_regnamespace('firma_privada') IS NOT NULL OR to_regclass('public.procesos_firma') IS NOT NULL
  OR to_regclass('public.firmantes_proceso') IS NOT NULL OR to_regclass('public.evidencias_firma') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   AND p.proname IN('firma_fuentes_para_verificar','registrar_validacion_documento_firma','iniciar_proceso_firma','cancelar_proceso_firma')) THEN
  RAISE EXCEPTION 'Existe infraestructura 2C previa: no se reemplaza';
 END IF;
 IF EXISTS(SELECT 1 FROM public.contratos WHERE estado IS NULL) THEN
  RAISE EXCEPTION 'Existen contratos sin estado: requieren conciliación previa';
 END IF;
 IF EXISTS(SELECT 1 FROM public.contratos WHERE estado::text='PENDIENTE_FIRMA') THEN
  RAISE EXCEPTION 'Existen contratos pendientes sin proceso 2C: requieren conciliación previa';
 END IF;
END $preflight$;

CREATE SCHEMA firma_privada;
REVOKE ALL ON SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;

-- Cobertura aprobada por versión de plantilla: qué roles nombra el documento y cuántos.
-- maximo<=1 porque datos_snapshot no guarda IDs: un lugar por rol es la única
-- correspondencia inequívoca entre el texto firmado y la parte contractual.
-- Solo el propietario la registra (registrar_cobertura_plantilla), tras aprobación jurídica.
CREATE TABLE firma_privada.cobertura_plantilla (
 version_plantilla_id uuid NOT NULL REFERENCES public.versiones_plantilla(id) ON DELETE RESTRICT,
 sha256_contenido text NOT NULL CHECK(sha256_contenido ~ '^[0-9a-f]{64}$'),
 rol text NOT NULL CHECK(rol IN('ARRENDADOR','ARRENDATARIO','FIADOR','OBLIGADO_SOLIDARIO','REPRESENTANTE_LEGAL')),
 minimo integer NOT NULL CHECK(minimo>=0),
 maximo integer NOT NULL CHECK(maximo BETWEEN minimo AND 1),
 entidades text[] NOT NULL CHECK(cardinality(entidades)>0 AND entidades<@ARRAY['PERSONA','PERSONA_MORAL']),
 aprobacion text NOT NULL CHECK(btrim(aprobacion)<>''),
 registrado_por text NOT NULL DEFAULT current_user,
 registrado_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(version_plantilla_id,rol),
 CHECK(rol='ARRENDADOR' OR NOT('PERSONA_MORAL'=ANY(entidades))),
 CHECK(rol NOT IN('ARRENDADOR','ARRENDATARIO') OR minimo=1)
);

-- Recibo interno de verificación; NO es evidencia de firma ni una entidad pública.
-- Solo el backend privilegiado lo emite tras descargar/hash del PDF y reconstruir contexto y HTML.
CREATE TABLE firma_privada.validaciones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contrato_id uuid NOT NULL, documento_id uuid NOT NULL, actor_id uuid NOT NULL,
 version_plantilla_id uuid NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 sha256_html text NOT NULL CHECK(sha256_html ~ '^[0-9a-f]{64}$'),
 sha256_plantilla text NOT NULL CHECK(sha256_plantilla ~ '^[0-9a-f]{64}$'),
 revision_renderer text NOT NULL CHECK(btrim(revision_renderer)<>'' AND length(revision_renderer)<=200),
 documento jsonb NOT NULL, fuentes jsonb NOT NULL, identidades jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 usado_por uuid
);

CREATE TABLE public.procesos_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
 documento_origen_id uuid NOT NULL REFERENCES public.documentos_contrato(id) ON DELETE RESTRICT,
 version_plantilla_id uuid NOT NULL REFERENCES public.versiones_plantilla(id) ON DELETE RESTRICT,
 validacion_id uuid NOT NULL UNIQUE REFERENCES firma_privada.validaciones(id) ON DELETE RESTRICT,
 metodo text NOT NULL DEFAULT 'MANUAL' CHECK(metodo='MANUAL'),
 estado text NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN('PENDIENTE','COMPLETADO','CANCELADO')),
 sha256_documento_origen text NOT NULL CHECK(sha256_documento_origen ~ '^[0-9a-f]{64}$'),
 size_bytes_origen bigint NOT NULL CHECK(size_bytes_origen BETWEEN 1 AND 10485760),
 sha256_html text NOT NULL CHECK(sha256_html ~ '^[0-9a-f]{64}$'),
 sha256_plantilla text NOT NULL CHECK(sha256_plantilla ~ '^[0-9a-f]{64}$'),
 revision_renderer text NOT NULL CHECK(btrim(revision_renderer)<>''),
 storage_path_origen text NOT NULL CHECK(btrim(storage_path_origen)<>''),
 documento_snapshot jsonb NOT NULL CHECK(jsonb_typeof(documento_snapshot)='object'),
 fuentes_snapshot jsonb NOT NULL CHECK(jsonb_typeof(fuentes_snapshot)='object'),
 cobertura_snapshot jsonb NOT NULL CHECK(jsonb_typeof(cobertura_snapshot)='array'),
 iniciado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 iniciado_at timestamptz NOT NULL DEFAULT now(),
 completado_at timestamptz,
 cancelado_at timestamptz,
 cancelado_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 motivo_cancelacion text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((estado='PENDIENTE' AND completado_at IS NULL AND cancelado_at IS NULL AND cancelado_por IS NULL AND motivo_cancelacion IS NULL)
 OR (estado='COMPLETADO' AND completado_at IS NOT NULL AND cancelado_at IS NULL AND cancelado_por IS NULL AND motivo_cancelacion IS NULL)
 OR (estado='CANCELADO' AND completado_at IS NULL AND cancelado_at IS NOT NULL AND cancelado_por IS NOT NULL AND nullif(btrim(motivo_cancelacion),'') IS NOT NULL))
);
CREATE UNIQUE INDEX procesos_firma_un_pendiente ON public.procesos_firma(contrato_id) WHERE estado='PENDIENTE';
CREATE INDEX procesos_firma_documento_idx ON public.procesos_firma(documento_origen_id);
CREATE INDEX procesos_firma_version_idx ON public.procesos_firma(version_plantilla_id);
CREATE INDEX procesos_firma_historial_idx ON public.procesos_firma(contrato_id,iniciado_at DESC);
ALTER TABLE firma_privada.validaciones ADD CONSTRAINT validaciones_usado_por_fk
 FOREIGN KEY(usado_por) REFERENCES public.procesos_firma(id) ON DELETE RESTRICT;

CREATE TABLE public.firmantes_proceso (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL REFERENCES public.procesos_firma(id) ON DELETE RESTRICT,
 parte_contrato_id uuid NOT NULL REFERENCES public.partes_contrato(id) ON DELETE RESTRICT,
 rol text NOT NULL CHECK(rol IN('ARRENDADOR','ARRENDATARIO','FIADOR','OBLIGADO_SOLIDARIO','REPRESENTANTE_LEGAL')),
 -- Clave de datos_snapshot que nombra a esta parte en el documento firmado.
 referencia_documento text NOT NULL CHECK(referencia_documento=lower(rol)),
 entidad_tipo text NOT NULL CHECK(entidad_tipo IN('PERSONA','PERSONA_MORAL')),
 entidad_id uuid NOT NULL,
 nombre_entidad text NOT NULL CHECK(btrim(nombre_entidad)<>''),
 persona_firmante_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE RESTRICT,
 representante_origen_id uuid REFERENCES public.representantes_persona_moral(id) ON DELETE RESTRICT,
 caracter text NOT NULL CHECK(btrim(caracter)<>''),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 requerido boolean NOT NULL DEFAULT true CHECK(requerido),
 estado text NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN('PENDIENTE','FIRMADO')),
 firmado_at timestamptz,
 registrado_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 -- Exactamente un firmante por parte y por lugar del documento.
 UNIQUE(proceso_firma_id,parte_contrato_id),
 UNIQUE(proceso_firma_id,referencia_documento),
 CHECK((entidad_tipo='PERSONA' AND representante_origen_id IS NULL AND persona_firmante_id=entidad_id)
 OR (entidad_tipo='PERSONA_MORAL' AND rol='ARRENDADOR' AND representante_origen_id IS NOT NULL)),
 CHECK((estado='PENDIENTE' AND firmado_at IS NULL AND registrado_por IS NULL)
 OR (estado='FIRMADO' AND firmado_at IS NOT NULL AND registrado_por IS NOT NULL))
);
CREATE INDEX firmantes_proceso_parte_idx ON public.firmantes_proceso(parte_contrato_id);
CREATE INDEX firmantes_proceso_persona_idx ON public.firmantes_proceso(persona_firmante_id);
CREATE INDEX firmantes_proceso_representante_idx ON public.firmantes_proceso(representante_origen_id);

CREATE TABLE public.evidencias_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL REFERENCES public.procesos_firma(id) ON DELETE RESTRICT,
 tipo text NOT NULL DEFAULT 'PDF_FIRMADO' CHECK(tipo='PDF_FIRMADO'),
 -- El prefijo de contrato se validará contra el proceso cuando se habilite la carga.
 storage_path text NOT NULL UNIQUE CHECK(storage_path ~ ('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/firmas/'||proceso_firma_id::text||'/'||id::text||'/firmado[.]pdf$')),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 uploaded_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidencias_firma_proceso_idx ON public.evidencias_firma(proceso_firma_id);

-- ---------------------------------------------------------------- auxiliares privadas
CREATE FUNCTION firma_privada.admin_actual() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=v_actor AND role='admin') THEN
  RAISE EXCEPTION 'Se requiere administrador autenticado' USING ERRCODE='42501';
 END IF;
 RETURN v_actor;
END $$;

-- Equivalente SQL de templateText(): recorta, colapsa espacios y trata null/undefined como vacío.
-- Una divergencia (p. ej. espacios Unicode exóticos) produce rechazo, nunca aceptación.
CREATE FUNCTION firma_privada.texto(p_valor text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN t ~* '^(null|undefined)$' THEN '' ELSE t END
 FROM (SELECT regexp_replace(regexp_replace(coalesce(p_valor,''),'^[[:space:]]+|[[:space:]]+$','','g'),'[[:space:]]+',' ','g') AS t) x
$$;
-- Equivalente de fullName(): partes no vacías unidas por un espacio.
CREATE FUNCTION firma_privada.nombre_completo(p_nombre text,p_paterno text,p_materno text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT concat_ws(' ',nullif(firma_privada.texto(p_nombre),''),nullif(firma_privada.texto(p_paterno),''),nullif(firma_privada.texto(p_materno),''))
$$;
CREATE FUNCTION firma_privada.sha256_texto(p_valor text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(p_valor,'UTF8')),'hex')
$$;

-- Conjunto completo y ordenado: detecta cambios de contrato, partes, identidades,
-- representante, unidad y edificio entre verificación e inicio. Comparación JSONB, no MD5.
CREATE FUNCTION firma_privada.fuentes(p_contrato uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('contrato',to_jsonb(c),'partes',coalesce((
  SELECT jsonb_agg(jsonb_build_object('parte',to_jsonb(pc),'persona',to_jsonb(pe),'moral',to_jsonb(pm),
   'representantes',coalesce((SELECT jsonb_agg(jsonb_build_object('vinculo',to_jsonb(r),'persona',to_jsonb(rp)) ORDER BY r.id)
    FROM public.representantes_persona_moral r LEFT JOIN public.personas rp ON rp.id=r.persona_id
    WHERE r.persona_moral_id=pm.id AND r.es_principal IS TRUE),'[]'::jsonb)) ORDER BY pc.id)
  FROM public.partes_contrato pc LEFT JOIN public.personas pe ON pe.id=pc.persona_id
  LEFT JOIN public.personas_morales pm ON pm.id=pc.persona_moral_id WHERE pc.contrato_id=c.id),'[]'::jsonb),
  'unidad',to_jsonb(u),'edificio',to_jsonb(e))
 FROM public.contratos c LEFT JOIN public.unidades u ON u.id=c.unidad_id
 LEFT JOIN public.edificios e ON e.id=u.edificio_id WHERE c.id=p_contrato
$$;

CREATE FUNCTION firma_privada.cobertura(p_version uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(k)-ARRAY['registrado_at'] ORDER BY k.rol),'[]'::jsonb)
 FROM firma_privada.cobertura_plantilla k WHERE k.version_plantilla_id=p_version
$$;

-- Documento elegible como origen: GENERADO, con PDF canónico, HTML, snapshot y versión.
-- PARA_FIRMA solo se reutiliza si fue origen de un proceso CANCELADO.
CREATE FUNCTION firma_privada.comprobar_documento(p_documento public.documentos_contrato,p_contrato uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_documento.id IS NULL OR p_documento.contrato_id IS DISTINCT FROM p_contrato THEN RAISE EXCEPTION 'Documento ajeno o inexistente'; END IF;
 IF p_documento.storage_path IS NULL OR btrim(p_documento.storage_path)='' OR p_documento.contenido_renderizado IS NULL
  OR btrim(p_documento.contenido_renderizado)='' OR jsonb_typeof(p_documento.datos_snapshot) IS DISTINCT FROM 'object'
  OR p_documento.version_plantilla_id IS NULL THEN
  RAISE EXCEPTION 'Documento sin PDF/snapshot/HTML/versión de plantilla';
 END IF;
 IF p_documento.nombre_archivo IS NULL OR p_documento.nombre_archivo !~* '^[A-Za-z0-9][A-Za-z0-9_-]{0,159}[.]pdf$'
  OR p_documento.storage_path IS DISTINCT FROM (p_contrato::text||'/'||p_documento.id::text||'/'||p_documento.nombre_archivo) THEN
  RAISE EXCEPTION 'Ruta origen no canónica';
 END IF;
 IF p_documento.estado::text IS DISTINCT FROM 'GENERADO' THEN RAISE EXCEPTION 'Documento no elegible: estado %',p_documento.estado; END IF;
 IF p_documento.tipo::text='PARA_FIRMA' THEN
  IF NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE documento_origen_id=p_documento.id AND estado='CANCELADO')
   OR EXISTS(SELECT 1 FROM public.procesos_firma WHERE documento_origen_id=p_documento.id AND estado<>'CANCELADO') THEN
   RAISE EXCEPTION 'Documento PARA_FIRMA sin proceso cancelado previo: no elegible';
  END IF;
 ELSIF p_documento.tipo::text IS DISTINCT FROM 'BORRADOR' THEN
  RAISE EXCEPTION 'Documento no elegible: tipo %',p_documento.tipo;
 END IF;
END $$;

-- Identidad inequívoca de cada firmante. Comprueba la cobertura aprobada de la versión,
-- la cardinalidad por rol y que el documento nombre exactamente a la entidad congelada.
-- Devuelve la correspondencia parte -> lugar del documento -> persona que firma.
CREATE FUNCTION firma_privada.identidades(p_contrato uuid,p_version uuid,p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_sha text; v_cov firma_privada.cobertura_plantilla%ROWTYPE; v_part public.partes_contrato%ROWTYPE;
 v_person public.personas%ROWTYPE; v_rep public.representantes_persona_moral%ROWTYPE; v_moral public.personas_morales%ROWTYPE;
 v_slot jsonb; v_count integer; v_role text; v_result jsonb:='[]'::jsonb;
BEGIN
 SELECT firma_privada.sha256_texto(contenido) INTO v_sha FROM public.versiones_plantilla WHERE id=p_version;
 IF NOT FOUND OR v_sha IS NULL THEN RAISE EXCEPTION 'Versión de plantilla inexistente o sin contenido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM firma_privada.cobertura_plantilla WHERE version_plantilla_id=p_version) THEN
  RAISE EXCEPTION 'La versión de plantilla no tiene cobertura de firma aprobada';
 END IF;
 IF EXISTS(SELECT 1 FROM firma_privada.cobertura_plantilla WHERE version_plantilla_id=p_version AND sha256_contenido<>v_sha) THEN
  RAISE EXCEPTION 'El contenido de la versión cambió después de aprobar su cobertura';
 END IF;
 FOR v_role IN SELECT DISTINCT rol::text FROM public.partes_contrato WHERE contrato_id=p_contrato ORDER BY 1 LOOP
  IF NOT EXISTS(SELECT 1 FROM firma_privada.cobertura_plantilla WHERE version_plantilla_id=p_version AND rol=v_role) THEN
   RAISE EXCEPTION 'El rol % no está cubierto por la versión de plantilla aprobada; no se omite ni se inventa redacción',v_role;
  END IF;
 END LOOP;
 FOR v_cov IN SELECT * FROM firma_privada.cobertura_plantilla WHERE version_plantilla_id=p_version ORDER BY rol LOOP
  SELECT count(*) INTO v_count FROM public.partes_contrato WHERE contrato_id=p_contrato AND rol::text=v_cov.rol;
  IF v_count<v_cov.minimo OR v_count>v_cov.maximo THEN
   RAISE EXCEPTION 'Cardinalidad de % fuera de la cobertura aprobada: % partes, permitido %..%',v_cov.rol,v_count,v_cov.minimo,v_cov.maximo;
  END IF;
  -- Sin parte en ese rol, el documento no puede nombrar a nadie en su lugar.
  v_slot:=p_snapshot->lower(v_cov.rol);
  IF v_count=0 AND jsonb_typeof(v_slot)='object'
   AND (firma_privada.texto(v_slot->>'nombre_completo')<>'' OR firma_privada.texto(v_slot->>'nombre')<>'') THEN
   RAISE EXCEPTION 'El documento nombra un % que no es parte del contrato',v_cov.rol;
  END IF;
 END LOOP;
 FOR v_part IN SELECT * FROM public.partes_contrato WHERE contrato_id=p_contrato ORDER BY id LOOP
  v_role:=v_part.rol::text;
  SELECT * INTO v_cov FROM firma_privada.cobertura_plantilla WHERE version_plantilla_id=p_version AND rol=v_role;
  v_slot:=p_snapshot->lower(v_role);
  IF jsonb_typeof(v_slot) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'El documento no identifica al %',v_role; END IF;
  IF (v_part.persona_id IS NULL)=(v_part.persona_moral_id IS NULL) THEN RAISE EXCEPTION 'Parte sin entidad única'; END IF;
  IF v_part.persona_moral_id IS NOT NULL THEN
   IF NOT 'PERSONA_MORAL'=ANY(v_cov.entidades) THEN RAISE EXCEPTION 'La cobertura no admite persona moral para %',v_role; END IF;
   SELECT * INTO v_moral FROM public.personas_morales WHERE id=v_part.persona_moral_id;
   IF NOT FOUND OR firma_privada.texto(v_moral.razon_social)='' THEN RAISE EXCEPTION 'Persona moral sin razón social'; END IF;
   SELECT count(*) INTO v_count FROM public.representantes_persona_moral WHERE persona_moral_id=v_part.persona_moral_id AND es_principal IS TRUE;
   IF v_count<>1 THEN RAISE EXCEPTION 'Se requiere exactamente un representante principal (hay %)',v_count; END IF;
   SELECT * INTO v_rep FROM public.representantes_persona_moral WHERE persona_moral_id=v_part.persona_moral_id AND es_principal IS TRUE;
   SELECT * INTO v_person FROM public.personas WHERE id=v_rep.persona_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Representante sin persona'; END IF;
   IF firma_privada.texto(v_rep.caracter)='' THEN RAISE EXCEPTION 'Representante principal sin carácter'; END IF;
   IF (v_slot ? 'tipo' AND v_slot->>'tipo' IS DISTINCT FROM 'PERSONA_MORAL')
    OR firma_privada.texto(v_slot->>'razon_social') IS DISTINCT FROM firma_privada.texto(v_moral.razon_social)
    OR firma_privada.texto(v_slot#>>'{representante,nombre_completo}') IS DISTINCT FROM firma_privada.nombre_completo(v_person.nombre,v_person.apellido_paterno,v_person.apellido_materno)
    OR firma_privada.texto(v_slot#>>'{representante,rfc}') IS DISTINCT FROM firma_privada.texto(v_person.rfc)
    OR firma_privada.texto(v_slot#>>'{representante,curp}') IS DISTINCT FROM firma_privada.texto(v_person.curp) THEN
    RAISE EXCEPTION 'El documento no identifica a la persona moral % o a su representante principal congelado',v_role;
   END IF;
   v_result:=v_result||jsonb_build_array(jsonb_build_object('parte_contrato_id',v_part.id,'rol',v_role,'referencia_documento',lower(v_role),
    'entidad_tipo','PERSONA_MORAL','entidad_id',v_part.persona_moral_id,'persona_firmante_id',v_person.id,'representante_origen_id',v_rep.id));
  ELSE
   IF NOT 'PERSONA'=ANY(v_cov.entidades) THEN RAISE EXCEPTION 'La cobertura no admite persona física para %',v_role; END IF;
   SELECT * INTO v_person FROM public.personas WHERE id=v_part.persona_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Parte sin persona'; END IF;
   IF firma_privada.nombre_completo(v_person.nombre,v_person.apellido_paterno,v_person.apellido_materno)='' THEN RAISE EXCEPTION 'Persona sin nombre'; END IF;
   IF (v_role='ARRENDADOR' AND (v_slot->>'tipo' IS DISTINCT FROM 'PERSONA'
     OR firma_privada.texto(v_slot->>'nombre') IS DISTINCT FROM firma_privada.nombre_completo(v_person.nombre,v_person.apellido_paterno,v_person.apellido_materno)))
    OR (v_role<>'ARRENDADOR' AND (firma_privada.texto(v_slot->>'nombre_completo') IS DISTINCT FROM firma_privada.nombre_completo(v_person.nombre,v_person.apellido_paterno,v_person.apellido_materno)
     OR firma_privada.texto(v_slot->>'curp') IS DISTINCT FROM firma_privada.texto(v_person.curp)))
    OR firma_privada.texto(v_slot->>'rfc') IS DISTINCT FROM firma_privada.texto(v_person.rfc) THEN
    RAISE EXCEPTION 'El documento no identifica a la persona del rol %',v_role;
   END IF;
   v_result:=v_result||jsonb_build_array(jsonb_build_object('parte_contrato_id',v_part.id,'rol',v_role,'referencia_documento',lower(v_role),
    'entidad_tipo','PERSONA','entidad_id',v_person.id,'persona_firmante_id',v_person.id,'representante_origen_id',NULL));
  END IF;
 END LOOP;
 RETURN v_result;
END $$;

-- Registro de cobertura: solo propietario, tras aprobación jurídica de la versión exacta.
-- p_roles: [{"rol":"ARRENDADOR","minimo":1,"maximo":1,"entidades":["PERSONA_MORAL"]}, ...]
CREATE FUNCTION firma_privada.registrar_cobertura_plantilla(p_version uuid,p_sha256 text,p_roles jsonb,p_aprobacion text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_item record;
BEGIN
 PERFORM 1 FROM public.versiones_plantilla WHERE id=p_version AND firma_privada.sha256_texto(contenido)=p_sha256 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La versión no existe o su contenido no coincide con el SHA-256 aprobado'; END IF;
 IF jsonb_typeof(p_roles) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Roles de cobertura inválidos'; END IF;
 FOR v_item IN SELECT * FROM jsonb_to_recordset(p_roles) AS x(rol text,minimo integer,maximo integer,entidades text[]) LOOP
  INSERT INTO firma_privada.cobertura_plantilla(version_plantilla_id,sha256_contenido,rol,minimo,maximo,entidades,aprobacion)
  VALUES(p_version,p_sha256,v_item.rol,v_item.minimo,v_item.maximo,v_item.entidades,p_aprobacion);
 END LOOP;
 IF (SELECT count(*) FROM firma_privada.cobertura_plantilla WHERE version_plantilla_id=p_version AND rol IN('ARRENDADOR','ARRENDATARIO'))<>2 THEN
  RAISE EXCEPTION 'La cobertura debe incluir ARRENDADOR y ARRENDATARIO';
 END IF;
END $$;

-- ---------------------------------------------------------------- RPC
CREATE FUNCTION public.firma_fuentes_para_verificar(p_contrato uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT firma_privada.fuentes(p_contrato)
$$;

-- EXECUTE solo service_role. El servidor debe autenticar p_actor, descargar el PDF exacto,
-- calcular SHA-256/tamaño, reconstruir contexto e HTML con la versión congelada y enviar
-- la correspondencia de identidades que usó. Datos de un cliente NO satisfacen este contrato.
CREATE FUNCTION public.registrar_validacion_documento_firma(p_actor uuid,p_contrato uuid,p_documento uuid,
 p_pdf_sha256 text,p_pdf_bytes bigint,p_fuentes jsonb,p_contexto_reconstruido jsonb,p_html_sha256 text,
 p_plantilla_sha256 text,p_revision_renderer text,p_identidades jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_doc public.documentos_contrato%ROWTYPE; v_state text; v_receipt uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Administrador inválido' USING ERRCODE='42501'; END IF;
 IF p_pdf_sha256 IS NULL OR p_pdf_sha256 !~ '^[0-9a-f]{64}$' OR p_html_sha256 IS NULL OR p_html_sha256 !~ '^[0-9a-f]{64}$'
  OR p_plantilla_sha256 IS NULL OR p_plantilla_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'SHA-256 inválido'; END IF;
 IF p_pdf_bytes IS NULL OR p_pdf_bytes NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Tamaño de PDF inválido'; END IF;
 IF nullif(btrim(p_revision_renderer),'') IS NULL THEN RAISE EXCEPTION 'Revisión de renderer obligatoria'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=p_contrato;
 IF NOT FOUND OR v_state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Contrato inexistente o no BORRADOR'; END IF;
 SELECT * INTO v_doc FROM public.documentos_contrato WHERE id=p_documento AND contrato_id=p_contrato;
 PERFORM firma_privada.comprobar_documento(v_doc,p_contrato);
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=p_contrato AND estado='PENDIENTE') THEN RAISE EXCEPTION 'Ya existe proceso pendiente'; END IF;
 IF p_fuentes IS NULL OR firma_privada.fuentes(p_contrato) IS DISTINCT FROM p_fuentes THEN RAISE EXCEPTION 'Fuentes cambiaron'; END IF;
 IF p_contexto_reconstruido IS NULL OR v_doc.datos_snapshot IS DISTINCT FROM p_contexto_reconstruido THEN RAISE EXCEPTION 'Documento desactualizado: contexto diferente'; END IF;
 IF firma_privada.sha256_texto(v_doc.contenido_renderizado) IS DISTINCT FROM p_html_sha256 THEN RAISE EXCEPTION 'Documento desactualizado: HTML reconstruido diferente'; END IF;
 IF (SELECT firma_privada.sha256_texto(contenido) FROM public.versiones_plantilla WHERE id=v_doc.version_plantilla_id) IS DISTINCT FROM p_plantilla_sha256 THEN
  RAISE EXCEPTION 'La versión de plantilla cambió';
 END IF;
 IF p_identidades IS NULL OR firma_privada.identidades(p_contrato,v_doc.version_plantilla_id,v_doc.datos_snapshot) IS DISTINCT FROM p_identidades THEN
  RAISE EXCEPTION 'Identidades de firmantes no coinciden con la reconstrucción';
 END IF;
 INSERT INTO firma_privada.validaciones(contrato_id,documento_id,actor_id,version_plantilla_id,sha256,size_bytes,sha256_html,
  sha256_plantilla,revision_renderer,documento,fuentes,identidades)
 VALUES(p_contrato,p_documento,p_actor,v_doc.version_plantilla_id,p_pdf_sha256,p_pdf_bytes,p_html_sha256,
  p_plantilla_sha256,btrim(p_revision_renderer),to_jsonb(v_doc),p_fuentes,p_identidades) RETURNING id INTO v_receipt;
 RETURN v_receipt;
END $$;

CREATE FUNCTION public.iniciar_proceso_firma(p_contrato uuid,p_documento uuid,p_sha256 text,p_validacion uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_actor uuid:=firma_privada.admin_actual(); v_contract public.contratos%ROWTYPE; v_doc public.documentos_contrato%ROWTYPE;
 v_receipt firma_privada.validaciones%ROWTYPE; v_item record; v_person public.personas%ROWTYPE;
 v_rep public.representantes_persona_moral%ROWTYPE; v_entity jsonb; v_name text; v_caracter text; v_snapshot jsonb;
 v_process uuid; v_ids jsonb;
BEGIN
 -- Orden 2B.0: contrato primero. Bloquear el contrato serializa partes (su trigger lo bloquea).
 SELECT * INTO v_contract FROM public.contratos WHERE id=p_contrato FOR UPDATE;
 IF NOT FOUND OR v_contract.estado::text IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Contrato inexistente o no BORRADOR'; END IF;
 SELECT * INTO v_doc FROM public.documentos_contrato WHERE id=p_documento AND contrato_id=p_contrato FOR UPDATE;
 PERFORM firma_privada.comprobar_documento(v_doc,p_contrato);
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=p_contrato AND estado='PENDIENTE') THEN RAISE EXCEPTION 'Ya existe proceso pendiente'; END IF;
 SELECT * INTO v_receipt FROM firma_privada.validaciones WHERE id=p_validacion FOR UPDATE;
 IF NOT FOUND OR v_receipt.actor_id IS DISTINCT FROM v_actor OR v_receipt.contrato_id IS DISTINCT FROM p_contrato
  OR v_receipt.documento_id IS DISTINCT FROM p_documento OR v_receipt.sha256 IS DISTINCT FROM p_sha256
  OR v_receipt.usado_por IS NOT NULL OR v_receipt.expires_at<=clock_timestamp()
  OR v_receipt.version_plantilla_id IS DISTINCT FROM v_doc.version_plantilla_id
  OR v_receipt.documento IS DISTINCT FROM to_jsonb(v_doc) THEN
  RAISE EXCEPTION 'Validación de PDF/contexto ausente, caducada, usada o desactualizada';
 END IF;
 -- Bloqueos de fila (no de tabla) sobre las fuentes exactas: no detienen escrituras
 -- ajenas a este contrato. Las esperas quedan acotadas por lock_timeout.
 PERFORM 1 FROM public.versiones_plantilla WHERE id=v_doc.version_plantilla_id FOR SHARE;
 PERFORM 1 FROM public.personas_morales WHERE id IN(SELECT persona_moral_id FROM public.partes_contrato WHERE contrato_id=p_contrato) ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.representantes_persona_moral WHERE persona_moral_id IN(SELECT persona_moral_id FROM public.partes_contrato WHERE contrato_id=p_contrato) ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.personas WHERE id IN(SELECT persona_id FROM public.partes_contrato WHERE contrato_id=p_contrato
  UNION SELECT r.persona_id FROM public.representantes_persona_moral r JOIN public.partes_contrato pc ON pc.persona_moral_id=r.persona_moral_id
  WHERE pc.contrato_id=p_contrato AND r.es_principal IS TRUE) ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.unidades WHERE id=v_contract.unidad_id FOR SHARE;
 PERFORM 1 FROM public.edificios WHERE id=(SELECT edificio_id FROM public.unidades WHERE id=v_contract.unidad_id) FOR SHARE;
 -- Comparación posterior a los bloqueos: lo congelado es exactamente lo verificado.
 IF firma_privada.fuentes(p_contrato) IS DISTINCT FROM v_receipt.fuentes THEN RAISE EXCEPTION 'Fuentes cambiaron desde la verificación'; END IF;
 IF (SELECT firma_privada.sha256_texto(contenido) FROM public.versiones_plantilla WHERE id=v_doc.version_plantilla_id) IS DISTINCT FROM v_receipt.sha256_plantilla THEN
  RAISE EXCEPTION 'La versión de plantilla cambió desde la verificación';
 END IF;
 IF firma_privada.sha256_texto(v_doc.contenido_renderizado) IS DISTINCT FROM v_receipt.sha256_html THEN RAISE EXCEPTION 'HTML cambió desde la verificación'; END IF;
 v_ids:=firma_privada.identidades(p_contrato,v_doc.version_plantilla_id,v_doc.datos_snapshot);
 IF v_ids IS DISTINCT FROM v_receipt.identidades THEN RAISE EXCEPTION 'Identidades de firmantes cambiaron desde la verificación'; END IF;

 INSERT INTO public.procesos_firma(contrato_id,documento_origen_id,version_plantilla_id,validacion_id,sha256_documento_origen,size_bytes_origen,
  sha256_html,sha256_plantilla,revision_renderer,storage_path_origen,documento_snapshot,fuentes_snapshot,cobertura_snapshot,iniciado_por)
 VALUES(p_contrato,p_documento,v_doc.version_plantilla_id,p_validacion,p_sha256,v_receipt.size_bytes,
  v_receipt.sha256_html,v_receipt.sha256_plantilla,v_receipt.revision_renderer,v_doc.storage_path,to_jsonb(v_doc),v_receipt.fuentes,
  firma_privada.cobertura(v_doc.version_plantilla_id),v_actor) RETURNING id INTO v_process;
 FOR v_item IN SELECT * FROM jsonb_to_recordset(v_ids) AS x(parte_contrato_id uuid,rol text,referencia_documento text,entidad_tipo text,
  entidad_id uuid,persona_firmante_id uuid,representante_origen_id uuid) LOOP
  SELECT * INTO v_person FROM public.personas WHERE id=v_item.persona_firmante_id;
  IF v_item.entidad_tipo='PERSONA_MORAL' THEN
   SELECT to_jsonb(pm),firma_privada.texto(pm.razon_social) INTO v_entity,v_name FROM public.personas_morales pm WHERE pm.id=v_item.entidad_id;
   SELECT * INTO v_rep FROM public.representantes_persona_moral WHERE id=v_item.representante_origen_id;
   v_caracter:=firma_privada.texto(v_rep.caracter);
   v_snapshot:=jsonb_build_object('parte',(SELECT to_jsonb(pc) FROM public.partes_contrato pc WHERE pc.id=v_item.parte_contrato_id),
    'entidad',v_entity,'representante',to_jsonb(v_rep),'persona_firmante',to_jsonb(v_person));
  ELSE
   v_name:=firma_privada.nombre_completo(v_person.nombre,v_person.apellido_paterno,v_person.apellido_materno);
   v_caracter:='POR_DERECHO_PROPIO';
   v_snapshot:=jsonb_build_object('parte',(SELECT to_jsonb(pc) FROM public.partes_contrato pc WHERE pc.id=v_item.parte_contrato_id),
    'persona_firmante',to_jsonb(v_person));
  END IF;
  INSERT INTO public.firmantes_proceso(proceso_firma_id,parte_contrato_id,rol,referencia_documento,entidad_tipo,entidad_id,nombre_entidad,
   persona_firmante_id,representante_origen_id,caracter,snapshot)
  VALUES(v_process,v_item.parte_contrato_id,v_item.rol,v_item.referencia_documento,v_item.entidad_tipo,v_item.entidad_id,v_name,
   v_item.persona_firmante_id,v_item.representante_origen_id,v_caracter,v_snapshot);
 END LOOP;
 IF v_doc.tipo::text='BORRADOR' THEN UPDATE public.documentos_contrato SET tipo='PARA_FIRMA' WHERE id=p_documento; END IF;
 UPDATE public.contratos SET estado='PENDIENTE_FIRMA' WHERE id=p_contrato;
 UPDATE firma_privada.validaciones SET usado_por=v_process WHERE id=p_validacion;
 RETURN v_process;
END $$;

CREATE FUNCTION public.cancelar_proceso_firma(p_proceso uuid,p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_actor uuid:=firma_privada.admin_actual(); v_process public.procesos_firma%ROWTYPE; v_cid uuid; v_state text;
BEGIN
 IF nullif(btrim(p_motivo),'') IS NULL OR length(p_motivo)>1000 THEN RAISE EXCEPTION 'Motivo obligatorio (máximo 1000 caracteres)'; END IF;
 -- contrato_id de un proceso es inmutable: se lee sin bloqueo y se bloquea en orden contrato -> proceso.
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND estado='FIRMADO') OR EXISTS(SELECT 1 FROM public.evidencias_firma WHERE proceso_firma_id=p_proceso) THEN
  RAISE EXCEPTION 'Proceso con firmas/evidencias requiere resolución posterior explícita';
 END IF;
 UPDATE public.procesos_firma SET estado='CANCELADO',cancelado_at=now(),cancelado_por=v_actor,motivo_cancelacion=btrim(p_motivo),updated_at=now() WHERE id=p_proceso;
 UPDATE public.contratos SET estado='BORRADOR' WHERE id=v_cid;
 -- Documento PARA_FIRMA/GENERADO conservado: cancelar un proceso no anula su contenido.
END $$;

-- ---------------------------------------------------------------- triggers de tablas nuevas
-- Invoker: current_user distingue al propietario (RPC SECURITY DEFINER) de escrituras directas.
-- Sin GUCs modificables por clientes. El propietario sigue siendo autoridad de mantenimiento.
CREATE FUNCTION firma_privada.proteger_proceso() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Escritura de firma solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se elimina auditoría de firma'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.estado<>'PENDIENTE' OR NOT EXISTS(SELECT 1 FROM public.documentos_contrato WHERE id=NEW.documento_origen_id AND contrato_id=NEW.contrato_id)
   OR NOT EXISTS(SELECT 1 FROM firma_privada.validaciones WHERE id=NEW.validacion_id AND contrato_id=NEW.contrato_id
    AND documento_id=NEW.documento_origen_id AND usado_por IS NULL AND sha256=NEW.sha256_documento_origen) THEN
   RAISE EXCEPTION 'Proceso inconsistente';
  END IF;
 ELSIF OLD.estado<>'PENDIENTE' OR NEW.estado<>'CANCELADO'
  OR (to_jsonb(OLD)-ARRAY['estado','cancelado_at','cancelado_por','motivo_cancelacion','updated_at']) IS DISTINCT FROM
     (to_jsonb(NEW)-ARRAY['estado','cancelado_at','cancelado_por','motivo_cancelacion','updated_at']) THEN
  RAISE EXCEPTION 'Solo cancelación controlada en etapa 1; identidad del proceso inmutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_proceso BEFORE INSERT OR UPDATE OR DELETE ON public.procesos_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_proceso();

CREATE FUNCTION firma_privada.proteger_firmante() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_part public.partes_contrato%ROWTYPE; v_process public.procesos_firma%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' OR current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Firmantes congelados; registro de firma no habilitado en etapa 1';
 END IF;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=NEW.proceso_firma_id;
 SELECT * INTO v_part FROM public.partes_contrato WHERE id=NEW.parte_contrato_id;
 IF v_part.contrato_id IS DISTINCT FROM v_process.contrato_id OR NEW.rol IS DISTINCT FROM v_part.rol::text
  OR NEW.entidad_id IS DISTINCT FROM coalesce(v_part.persona_id,v_part.persona_moral_id)
  OR NEW.entidad_tipo IS DISTINCT FROM (CASE WHEN v_part.persona_id IS NOT NULL THEN 'PERSONA' ELSE 'PERSONA_MORAL' END)
  OR v_process.estado IS DISTINCT FROM 'PENDIENTE' OR NEW.estado<>'PENDIENTE'
  OR (NEW.entidad_tipo='PERSONA_MORAL' AND NOT EXISTS(SELECT 1 FROM public.representantes_persona_moral
   WHERE id=NEW.representante_origen_id AND persona_moral_id=NEW.entidad_id AND persona_id=NEW.persona_firmante_id)) THEN
  RAISE EXCEPTION 'Firmante ajeno/inconsistente';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_firmante BEFORE INSERT OR UPDATE OR DELETE ON public.firmantes_proceso FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_firmante();

CREATE FUNCTION firma_privada.proteger_evidencia() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Carga/registro de evidencias no habilitado en etapa 1';
END $$;
CREATE TRIGGER firma_2c_evidencia BEFORE INSERT OR UPDATE OR DELETE ON public.evidencias_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_evidencia();

-- ---------------------------------------------------------------- triggers de tablas existentes
-- Máquina de estados explícita (lista blanca). Etapa 1 no habilita FIRMADO.
CREATE FUNCTION firma_privada.proteger_contrato() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old text; v_new text;
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id) THEN RAISE EXCEPTION 'Contrato con historial de firma no eliminable'; END IF;
  IF OLD.estado::text IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Solo se eliminan contratos BORRADOR'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.estado::text IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Un contrato nuevo debe crearse en BORRADOR'; END IF;
  RETURN NEW;
 END IF;
 v_old:=OLD.estado::text; v_new:=NEW.estado::text;
 -- Fuera de BORRADOR se congela toda la fila salvo estado/updated_at.
 IF v_old IS DISTINCT FROM 'BORRADOR'
  AND (to_jsonb(OLD)-ARRAY['estado','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['estado','updated_at']) THEN
  RAISE EXCEPTION 'Condiciones congeladas fuera de BORRADOR';
 END IF;
 IF v_old IS DISTINCT FROM v_new THEN
  IF NOT ((v_old='BORRADOR' AND v_new IN('PENDIENTE_FIRMA','CANCELADO'))
   OR (v_old='PENDIENTE_FIRMA' AND v_new='BORRADOR')
   OR (v_old='FIRMADO' AND v_new='ACTIVO')
   OR (v_old='ACTIVO' AND v_new IN('FINALIZADO','TERMINADO_ANTICIPADAMENTE'))) THEN
   RAISE EXCEPTION 'Transición de contrato no permitida: % -> %',v_old,v_new;
  END IF;
  IF v_new='PENDIENTE_FIRMA' AND NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='PENDIENTE') THEN
   RAISE EXCEPTION 'Inicio de firma requiere proceso atómico';
  END IF;
  IF v_old='PENDIENTE_FIRMA' AND EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='PENDIENTE') THEN
   RAISE EXCEPTION 'Solo cancelación controlada disponible';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_contrato BEFORE INSERT OR UPDATE OR DELETE ON public.contratos FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_contrato();

-- Mismo modo de bloqueo que partes_2b0_comprobar_arrendador (FOR UPDATE del contrato):
-- sin escalamiento de bloqueo dentro de la misma transacción y con espera acotada.
-- Contrato no visible = borrado en cascada (ya validado por firma_2c_contrato) o FK inválida.
CREATE FUNCTION firma_privada.proteger_parte() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_cid uuid; v_state text;
BEGIN
 FOR v_cid IN SELECT DISTINCT x FROM unnest(ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.contrato_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.contrato_id END]) x
  WHERE x IS NOT NULL ORDER BY x LOOP
  SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF v_state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Partes congeladas fuera de BORRADOR'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_parte BEFORE INSERT OR UPDATE OR DELETE ON public.partes_contrato FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_parte();

-- Documentos: contenido inmutable, ruta PDF una sola vez, tipo solo por el inicio de firma,
-- estado hacia delante. UPDATE/DELETE no bloquean el contrato: el autor ya tiene la fila
-- del documento y la RPC toma contrato -> documento; esperar aquí invertiría el orden.
CREATE FUNCTION firma_privada.proteger_documento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_state text; v_origin boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.contrato_id IS NULL THEN RAISE EXCEPTION 'Documento sin contrato'; END IF;
  SELECT estado::text INTO v_state FROM public.contratos WHERE id=NEW.contrato_id FOR SHARE;
  IF FOUND AND v_state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Nuevas revisiones solo en BORRADOR'; END IF;
  IF NEW.tipo::text IS DISTINCT FROM 'BORRADOR' OR NEW.estado::text IS DISTINCT FROM 'GENERADO' THEN
   RAISE EXCEPTION 'Un documento nuevo se crea BORRADOR/GENERADO';
  END IF;
  RETURN NEW;
 END IF;
 v_origin:=EXISTS(SELECT 1 FROM public.procesos_firma WHERE documento_origen_id=OLD.id);
 IF TG_OP='DELETE' THEN
  IF v_origin THEN RAISE EXCEPTION 'Documento origen inmutable'; END IF;
  SELECT estado::text INTO v_state FROM public.contratos WHERE id=OLD.contrato_id;
  IF FOUND AND v_state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Documentos conservados fuera de BORRADOR'; END IF;
  RETURN OLD;
 END IF;
 IF (to_jsonb(OLD)-ARRAY['storage_path','tipo','estado','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['storage_path','tipo','estado','updated_at']) THEN
  RAISE EXCEPTION 'Contenido y metadatos del documento son inmutables';
 END IF;
 IF NEW.storage_path IS DISTINCT FROM OLD.storage_path AND (OLD.storage_path IS NOT NULL
  OR NEW.storage_path IS DISTINCT FROM (OLD.contrato_id::text||'/'||OLD.id::text||'/'||OLD.nombre_archivo)) THEN
  RAISE EXCEPTION 'La ruta PDF se vincula una sola vez y en su ruta canónica';
 END IF;
 IF NEW.tipo::text IS DISTINCT FROM OLD.tipo::text AND NOT (OLD.tipo::text='BORRADOR' AND NEW.tipo::text='PARA_FIRMA'
  AND EXISTS(SELECT 1 FROM public.procesos_firma WHERE documento_origen_id=OLD.id AND estado='PENDIENTE')) THEN
  RAISE EXCEPTION 'Cambio de tipo documental solo mediante el inicio de firma';
 END IF;
 IF NEW.estado::text IS DISTINCT FROM OLD.estado::text THEN
  IF v_origin THEN RAISE EXCEPTION 'Documento origen inmutable'; END IF;
  IF NOT ((OLD.estado::text='GENERADO' AND NEW.estado::text IN('ENVIADO','REEMPLAZADO','ANULADO'))
   OR (OLD.estado::text='ENVIADO' AND NEW.estado::text IN('REEMPLAZADO','ANULADO'))) THEN
   RAISE EXCEPTION 'Transición documental no permitida: % -> %',OLD.estado,NEW.estado;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_documento BEFORE INSERT OR UPDATE OR DELETE ON public.documentos_contrato FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_documento();

-- Versión usada por un proceso: contenido e identidad inmutables; no se elimina.
-- El estado de la versión (p. ej. BORRADOR -> publicada) sigue siendo editable.
CREATE FUNCTION firma_privada.proteger_version_plantilla() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE version_plantilla_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Versión de plantilla usada en firma: no se elimina'; END IF;
  IF ROW(OLD.id,OLD.plantilla_id,OLD.numero_version,OLD.contenido) IS DISTINCT FROM ROW(NEW.id,NEW.plantilla_id,NEW.numero_version,NEW.contenido) THEN
   RAISE EXCEPTION 'Versión de plantilla usada en firma: contenido inmutable';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_version_plantilla BEFORE UPDATE OR DELETE ON public.versiones_plantilla FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_version_plantilla();

-- Consistencia al COMMIT: estado contractual y proceso cambian juntos; firmantes completos.
CREATE FUNCTION firma_privada.comprobar_transicion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cid uuid; v_state text; v_amount integer; v_process public.procesos_firma%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='contratos' THEN v_cid:=NEW.id;
 ELSIF TG_TABLE_NAME='procesos_firma' THEN v_cid:=NEW.contrato_id;
 ELSE SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=NEW.proceso_firma_id; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*) INTO v_amount FROM public.procesos_firma WHERE contrato_id=v_cid AND estado='PENDIENTE';
 IF (v_state='PENDIENTE_FIRMA' AND v_amount<>1) OR (v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' AND v_amount<>0) THEN
  RAISE EXCEPTION 'Proceso y estado contractual deben cambiar atómicamente';
 END IF;
 IF v_amount=1 THEN
  SELECT * INTO v_process FROM public.procesos_firma WHERE contrato_id=v_cid AND estado='PENDIENTE';
  IF EXISTS(SELECT 1 FROM public.partes_contrato pc WHERE pc.contrato_id=v_cid
    AND NOT EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=v_process.id AND f.parte_contrato_id=pc.id))
   OR EXISTS(SELECT 1 FROM public.firmantes_proceso f LEFT JOIN public.partes_contrato pc ON pc.id=f.parte_contrato_id
    WHERE f.proceso_firma_id=v_process.id AND pc.contrato_id IS DISTINCT FROM v_cid) THEN
   RAISE EXCEPTION 'Proceso sin firmantes completos';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.documentos_contrato d WHERE d.id=v_process.documento_origen_id AND d.contrato_id=v_cid
   AND d.tipo::text='PARA_FIRMA' AND d.estado::text='GENERADO') THEN RAISE EXCEPTION 'Documento origen inconsistente'; END IF;
  IF NOT EXISTS(SELECT 1 FROM firma_privada.validaciones WHERE id=v_process.validacion_id AND usado_por=v_process.id) THEN
   RAISE EXCEPTION 'Recibo de validación no consumido por el proceso';
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER firma_2c_transicion_proceso AFTER INSERT OR UPDATE ON public.procesos_firma DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();
CREATE CONSTRAINT TRIGGER firma_2c_transicion_firmante AFTER INSERT ON public.firmantes_proceso DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();
CREATE CONSTRAINT TRIGGER firma_2c_transicion_contrato AFTER INSERT OR UPDATE ON public.contratos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();

-- ---------------------------------------------------------------- RLS y privilegios
-- Lectura administrativa; escrituras solo RPC. RLS no basta frente a service_role (BYPASSRLS),
-- por eso se revocan también sus DML directos y existen triggers de integridad.
ALTER TABLE public.procesos_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firmantes_proceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias_firma ENABLE ROW LEVEL SECURITY;
CREATE POLICY procesos_firma_admin_lectura ON public.procesos_firma FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE POLICY firmantes_proceso_admin_lectura ON public.firmantes_proceso FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE POLICY evidencias_firma_admin_lectura ON public.evidencias_firma FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
REVOKE ALL ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma TO authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.firma_fuentes_para_verificar(uuid),
 public.registrar_validacion_documento_firma(uuid,uuid,uuid,text,bigint,jsonb,jsonb,text,text,text,jsonb),
 public.iniciar_proceso_firma(uuid,uuid,text,uuid),public.cancelar_proceso_firma(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.firma_fuentes_para_verificar(uuid),
 public.registrar_validacion_documento_firma(uuid,uuid,uuid,text,bigint,jsonb,jsonb,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_proceso_firma(uuid,uuid,text,uuid),public.cancelar_proceso_firma(uuid,text) TO authenticated;

-- Comprobación final: los privilegios predeterminados de Supabase en public conceden permisos
-- amplios a roles que no se pueden enumerar de antemano. Se valida el ACL efectivo y se aborta
-- ante cualquier concesión fuera de la lista blanca (PUBLIC incluido).
DO $postflight$
DECLARE v_bad text; v_auth oid:='authenticated'::regrole; v_service oid:='service_role'::regrole;
BEGIN
 SELECT string_agg(format('%s: %s para %s',x.obj,x.priv,CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END),'; ' ORDER BY x.obj,x.priv)
 INTO v_bad FROM (
  SELECT c.oid::regclass::text AS obj,a.privilege_type AS priv,a.grantee,
   a.grantee=c.relowner OR (n.nspname='public' AND a.privilege_type='SELECT' AND a.grantee IN(v_auth,v_service)) AS ok
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
  WHERE c.relkind IN('r','p','v','m','S','f')
   AND ((n.nspname='public' AND c.relname IN('procesos_firma','firmantes_proceso','evidencias_firma')) OR n.nspname='firma_privada')
  UNION ALL
  SELECT p.oid::regprocedure::text,a.privilege_type,a.grantee,
   a.grantee=p.proowner
   OR (n.nspname='public' AND p.proname IN('firma_fuentes_para_verificar','registrar_validacion_documento_firma') AND a.grantee=v_service)
   OR (n.nspname='public' AND p.proname IN('iniciar_proceso_firma','cancelar_proceso_firma') AND a.grantee=v_auth)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE n.nspname='firma_privada' OR (n.nspname='public' AND p.proname IN('firma_fuentes_para_verificar',
   'registrar_validacion_documento_firma','iniciar_proceso_firma','cancelar_proceso_firma'))
  UNION ALL
  SELECT 'schema firma_privada',a.privilege_type,a.grantee,a.grantee=n.nspowner
  FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  WHERE n.nspname='firma_privada'
 ) x WHERE NOT x.ok;
 IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Privilegios inesperados tras instalar 2C: %',v_bad; END IF;
END $postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
