-- 2C ETAPA 1. PROPUESTA MANUAL PARA REVISIÓN. NO ejecutar desde frontend/CI.
-- No activa contratos existentes. Requiere revisión del DDL/policies reales.
BEGIN;
SET LOCAL lock_timeout = '10s';
-- Preflight de compatibilidad básica; no sustituye la revisión externa de RLS/triggers.
DO $preflight$
DECLARE spec record; col text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('contratos',ARRAY['id','solicitud_id','folio','created_at','updated_at','arrendador_persona_moral_id','estado','unidad_id','fecha_inicio','fecha_fin','renta','deposito','dia_pago','fecha_firma','lugar_firma','costo_lavanderia','domicilio_arrendador','domicilio_arrendatario','domicilio_fiador']),
 ('documentos_contrato',ARRAY['id','contrato_id','version_plantilla_id','numero_version','tipo','estado','nombre_archivo','storage_path','datos_snapshot','contenido_renderizado','generated_at','created_at','updated_at']),
 ('partes_contrato',ARRAY['id','contrato_id','persona_id','persona_moral_id','rol']),
 ('personas',ARRAY['id','nombre','apellido_paterno','apellido_materno']),
 ('personas_morales',ARRAY['id','razon_social']),
 ('representantes_persona_moral',ARRAY['id','persona_moral_id','persona_id','caracter','es_principal']),
 ('unidades',ARRAY['id','edificio_id']),('edificios',ARRAY['id']),('users',ARRAY['id','role'])
 ) AS required(tab,cols) LOOP
  FOREACH col IN ARRAY spec.cols LOOP
   IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=spec.tab AND column_name=col) THEN
    RAISE EXCEPTION 'Falta columna requerida %.%',spec.tab,col;
   END IF;
  END LOOP;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Instalar con propietario confiable BYPASSRLS/superusuario; SECURITY DEFINER por sí solo no elude RLS';
 END IF;
 IF current_user IN('anon','authenticated','service_role') THEN RAISE EXCEPTION 'Rol de instalación no permitido'; END IF;
 IF to_regprocedure('auth.uid()') IS NULL THEN RAISE EXCEPTION 'Falta auth.uid()'; END IF;
 IF EXISTS(SELECT 1 FROM public.contratos WHERE estado::text='PENDIENTE_FIRMA') THEN
  RAISE EXCEPTION 'Existen contratos pendientes sin proceso 2C: requieren conciliación previa';
 END IF;
END $preflight$;
CREATE SCHEMA firma_privada;
REVOKE ALL ON SCHEMA firma_privada FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.procesos_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
 documento_origen_id uuid NOT NULL REFERENCES public.documentos_contrato(id) ON DELETE RESTRICT,
 metodo text NOT NULL DEFAULT 'MANUAL' CHECK(metodo='MANUAL'),
 estado text NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN('PENDIENTE','COMPLETADO','CANCELADO')),
 sha256_documento_origen text NOT NULL CHECK(sha256_documento_origen ~ '^[0-9a-f]{64}$'),
 storage_path_origen text NOT NULL CHECK(btrim(storage_path_origen)<>''),
 documento_snapshot jsonb NOT NULL CHECK(jsonb_typeof(documento_snapshot)='object'),
 fuentes_snapshot jsonb NOT NULL CHECK(jsonb_typeof(fuentes_snapshot)='object'),
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
CREATE INDEX procesos_firma_historial_idx ON public.procesos_firma(contrato_id,iniciado_at DESC);

CREATE TABLE public.firmantes_proceso (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL REFERENCES public.procesos_firma(id) ON DELETE RESTRICT,
 parte_contrato_id uuid NOT NULL REFERENCES public.partes_contrato(id) ON DELETE RESTRICT,
 rol text NOT NULL CHECK(rol IN('ARRENDADOR','ARRENDATARIO','FIADOR','OBLIGADO_SOLIDARIO','REPRESENTANTE_LEGAL')),
 entidad_tipo text NOT NULL CHECK(entidad_tipo IN('PERSONA','PERSONA_MORAL')),
 entidad_id uuid NOT NULL,
 nombre_entidad text NOT NULL CHECK(btrim(nombre_entidad)<>''),
 persona_firmante_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE RESTRICT,
 representante_origen_id uuid REFERENCES public.representantes_persona_moral(id) ON DELETE RESTRICT,
 caracter text NOT NULL CHECK(btrim(caracter)<>''),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 requerido boolean NOT NULL DEFAULT true,
 estado text NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN('PENDIENTE','FIRMADO')),
 firmado_at timestamptz,
 registrado_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(proceso_firma_id,parte_contrato_id,persona_firmante_id),
 CHECK((entidad_tipo='PERSONA' AND representante_origen_id IS NULL AND persona_firmante_id=entidad_id)
 OR (entidad_tipo='PERSONA_MORAL' AND representante_origen_id IS NOT NULL)),
 CHECK((estado='PENDIENTE' AND firmado_at IS NULL AND registrado_por IS NULL)
 OR (estado='FIRMADO' AND firmado_at IS NOT NULL AND registrado_por IS NOT NULL))
);
CREATE INDEX firmantes_proceso_parte_idx ON public.firmantes_proceso(parte_contrato_id);
CREATE TABLE public.evidencias_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL REFERENCES public.procesos_firma(id) ON DELETE RESTRICT,
 tipo text NOT NULL DEFAULT 'PDF_FIRMADO' CHECK(tipo='PDF_FIRMADO'),
 storage_path text NOT NULL UNIQUE CHECK(storage_path ~ ('^[0-9a-f-]{36}/firmas/'||proceso_firma_id::text||'/'||id::text||'/firmado[.]pdf$')),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 size_bytes bigint NOT NULL CHECK(size_bytes>0),
 uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 uploaded_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidencias_firma_proceso_idx ON public.evidencias_firma(proceso_firma_id);

-- Recibo interno de verificación; NO es evidencia de firma ni una cuarta entidad pública.
-- Solo el backend privilegiado podrá emitirlo tras descargar/hash y reconstruir contexto.
CREATE TABLE firma_privada.validaciones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contrato_id uuid NOT NULL,
 documento_id uuid NOT NULL, actor_id uuid NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 documento jsonb NOT NULL, fuentes jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 usado_por uuid REFERENCES public.procesos_firma(id) ON DELETE RESTRICT
);
REVOKE ALL ON firma_privada.validaciones FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION firma_privada.admin_actual() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND role='admin') THEN
  RAISE EXCEPTION 'Se requiere administrador autenticado' USING ERRCODE='42501';
 END IF;
 RETURN actor;
END $$;

-- Conjunto completo y ordenado: detecta cambios de contrato, partes, identidades,
-- representante, unidad y edificio entre verificación e inicio. Comparación JSONB, no MD5.
CREATE FUNCTION firma_privada.fuentes(p_contrato uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('contrato',to_jsonb(c),'partes',coalesce((
  SELECT jsonb_agg(jsonb_build_object('parte',to_jsonb(pc),'persona',to_jsonb(pe),'moral',to_jsonb(pm),
   'representantes',coalesce((SELECT jsonb_agg(jsonb_build_object('vinculo',to_jsonb(r),'persona',to_jsonb(rp)) ORDER BY r.id)
    FROM public.representantes_persona_moral r LEFT JOIN public.personas rp ON rp.id=r.persona_id
    WHERE r.persona_moral_id=pm.id AND r.es_principal), '[]'::jsonb)) ORDER BY pc.id)
  FROM public.partes_contrato pc LEFT JOIN public.personas pe ON pe.id=pc.persona_id
  LEFT JOIN public.personas_morales pm ON pm.id=pc.persona_moral_id WHERE pc.contrato_id=c.id),'[]'::jsonb),
  'unidad',to_jsonb(u),'edificio',to_jsonb(e))
 FROM public.contratos c LEFT JOIN public.unidades u ON u.id=c.unidad_id
 LEFT JOIN public.edificios e ON e.id=u.edificio_id WHERE c.id=p_contrato
$$;
CREATE FUNCTION public.firma_fuentes_para_verificar(p_contrato uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT firma_privada.fuentes(p_contrato)
$$;

CREATE FUNCTION public.registrar_validacion_documento_firma(p_actor uuid,p_contrato uuid,p_documento uuid,p_sha256 text,p_fuentes jsonb,p_contexto_actual jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.documentos_contrato%ROWTYPE; receipt uuid;
BEGIN
 -- EXECUTE solo service_role. El servidor debe autenticar p_actor y verificar bytes de Storage;
 -- comparar únicamente texto/metadata de un cliente NO satisface este contrato de confianza.
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND role='admin') THEN RAISE EXCEPTION 'Administrador inválido'; END IF;
 IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'SHA-256 inválido'; END IF;
 SELECT * INTO d FROM public.documentos_contrato WHERE id=p_documento AND contrato_id=p_contrato;
 IF NOT FOUND OR d.storage_path IS NULL OR btrim(d.storage_path)='' THEN RAISE EXCEPTION 'Documento sin PDF o ajeno'; END IF;
 IF p_fuentes IS NULL OR firma_privada.fuentes(p_contrato) IS DISTINCT FROM p_fuentes THEN RAISE EXCEPTION 'Fuentes cambiaron'; END IF;
 IF p_contexto_actual IS NULL OR d.datos_snapshot IS DISTINCT FROM p_contexto_actual THEN RAISE EXCEPTION 'Documento desactualizado: contexto diferente'; END IF;
 INSERT INTO firma_privada.validaciones(contrato_id,documento_id,actor_id,sha256,documento,fuentes)
 VALUES(p_contrato,p_documento,p_actor,p_sha256,to_jsonb(d),p_fuentes) RETURNING id INTO receipt;
 RETURN receipt;
END $$;

CREATE FUNCTION public.iniciar_proceso_firma(p_contrato uuid,p_documento uuid,p_sha256 text,p_validacion uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=firma_privada.admin_actual(); c public.contratos%ROWTYPE; d public.documentos_contrato%ROWTYPE;
 v firma_privada.validaciones%ROWTYPE; part record; representative record; person record; process uuid; entity jsonb; name text;
BEGIN
 -- Orden 2B.0: contrato primero. Nunca SHARE sobre partes_contrato antes del contrato.
 SELECT * INTO c FROM public.contratos WHERE id=p_contrato FOR UPDATE;
 IF NOT FOUND OR c.estado IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Contrato inexistente o no BORRADOR'; END IF;
 -- Los catálogos no siguen necesariamente nuestro orden. NOWAIT evita esperar en
 -- un ciclo con otra RPC; SQLSTATE 55P03 exige reintentar la transacción completa.
 LOCK TABLE public.personas,public.personas_morales,public.representantes_persona_moral,public.unidades,public.edificios IN SHARE MODE NOWAIT;
 SELECT * INTO d FROM public.documentos_contrato WHERE id=p_documento AND contrato_id=p_contrato FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento ajeno o inexistente'; END IF;
 IF d.storage_path IS NULL OR btrim(d.storage_path)='' OR d.contenido_renderizado IS NULL OR btrim(d.contenido_renderizado)='' OR d.datos_snapshot IS NULL THEN RAISE EXCEPTION 'Documento sin PDF/snapshot/HTML'; END IF;
 IF d.nombre_archivo !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,159}[.]pdf$' OR d.storage_path IS DISTINCT FROM (p_contrato::text||'/'||p_documento::text||'/'||d.nombre_archivo) THEN RAISE EXCEPTION 'Ruta origen no canónica'; END IF;
 IF d.estado IS DISTINCT FROM 'GENERADO' OR d.tipo::text NOT IN('BORRADOR','PARA_FIRMA') THEN RAISE EXCEPTION 'Documento no elegible'; END IF;
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=p_contrato AND estado='PENDIENTE') THEN RAISE EXCEPTION 'Ya existe proceso pendiente'; END IF;
 SELECT * INTO v FROM firma_privada.validaciones WHERE id=p_validacion FOR UPDATE;
 IF NOT FOUND OR v.actor_id IS DISTINCT FROM actor OR v.contrato_id IS DISTINCT FROM p_contrato OR v.documento_id IS DISTINCT FROM p_documento
 OR v.sha256 IS DISTINCT FROM p_sha256 OR v.usado_por IS NOT NULL OR v.expires_at<=clock_timestamp()
 OR v.documento IS DISTINCT FROM to_jsonb(d) OR v.fuentes IS DISTINCT FROM firma_privada.fuentes(p_contrato) THEN
  RAISE EXCEPTION 'Validación de PDF/contexto ausente, caducada, usada o desactualizada';
 END IF;
 IF (SELECT count(*) FROM public.partes_contrato WHERE contrato_id=p_contrato AND rol='ARRENDADOR')<>1
 OR NOT EXISTS(SELECT 1 FROM public.partes_contrato WHERE contrato_id=p_contrato AND rol='ARRENDATARIO') THEN RAISE EXCEPTION 'Partes incompletas'; END IF;
 -- La plantilla actual no cubre estas obligaciones: no excluirlas ni inventar texto jurídico.
 IF EXISTS(SELECT 1 FROM public.partes_contrato WHERE contrato_id=p_contrato AND rol::text NOT IN('ARRENDADOR','ARRENDATARIO','FIADOR')) THEN
  RAISE EXCEPTION 'Hay roles sin cobertura aprobada de firma en la plantilla';
 END IF;
 INSERT INTO public.procesos_firma(contrato_id,documento_origen_id,sha256_documento_origen,storage_path_origen,documento_snapshot,fuentes_snapshot,iniciado_por)
 VALUES(p_contrato,p_documento,p_sha256,d.storage_path,to_jsonb(d),v.fuentes,actor) RETURNING id INTO process;
 FOR part IN SELECT * FROM public.partes_contrato WHERE contrato_id=p_contrato ORDER BY id LOOP
  IF (part.persona_id IS NULL)=(part.persona_moral_id IS NULL) THEN RAISE EXCEPTION 'Parte sin entidad única'; END IF;
  IF part.persona_moral_id IS NOT NULL THEN
   IF (SELECT count(*) FROM public.representantes_persona_moral WHERE persona_moral_id=part.persona_moral_id AND es_principal)<>1 THEN RAISE EXCEPTION 'Se requiere un representante principal'; END IF;
   SELECT * INTO representative FROM public.representantes_persona_moral WHERE persona_moral_id=part.persona_moral_id AND es_principal;
   SELECT to_jsonb(pm),regexp_replace(btrim(pm.razon_social),'[[:space:]]+',' ','g') INTO entity,name FROM public.personas_morales pm WHERE id=part.persona_moral_id;
   SELECT * INTO person FROM public.personas WHERE id=representative.persona_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Representante sin persona'; END IF;
   INSERT INTO public.firmantes_proceso(proceso_firma_id,parte_contrato_id,rol,entidad_tipo,entidad_id,nombre_entidad,persona_firmante_id,representante_origen_id,caracter,snapshot)
   VALUES(process,part.id,part.rol,'PERSONA_MORAL',part.persona_moral_id,name,person.id,representative.id,representative.caracter,
    jsonb_build_object('parte',to_jsonb(part),'entidad',entity,'representante',to_jsonb(representative),'persona_firmante',to_jsonb(person)));
  ELSE
   SELECT * INTO person FROM public.personas WHERE id=part.persona_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Parte sin persona'; END IF;
   name:=regexp_replace(btrim(concat_ws(' ',person.nombre,person.apellido_paterno,person.apellido_materno)),'[[:space:]]+',' ','g');
   INSERT INTO public.firmantes_proceso(proceso_firma_id,parte_contrato_id,rol,entidad_tipo,entidad_id,nombre_entidad,persona_firmante_id,caracter,snapshot)
   VALUES(process,part.id,part.rol,'PERSONA',part.persona_id,name,person.id,'POR_DERECHO_PROPIO',jsonb_build_object('parte',to_jsonb(part),'persona_firmante',to_jsonb(person)));
  END IF;
 END LOOP;
 UPDATE public.documentos_contrato SET tipo='PARA_FIRMA' WHERE id=p_documento;
 UPDATE public.contratos SET estado='PENDIENTE_FIRMA' WHERE id=p_contrato;
 UPDATE firma_privada.validaciones SET usado_por=process WHERE id=p_validacion;
 RETURN process;
END $$;
CREATE FUNCTION public.cancelar_proceso_firma(p_proceso uuid,p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=firma_privada.admin_actual(); process public.procesos_firma%ROWTYPE; cid uuid; state text;
BEGIN
 IF nullif(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Motivo obligatorio'; END IF;
 SELECT contrato_id INTO cid FROM public.procesos_firma WHERE id=p_proceso;
 SELECT estado INTO state FROM public.contratos WHERE id=cid FOR UPDATE;
 SELECT * INTO process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF NOT FOUND OR process.estado<>'PENDIENTE' OR state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND estado='FIRMADO') OR EXISTS(SELECT 1 FROM public.evidencias_firma WHERE proceso_firma_id=p_proceso) THEN
  RAISE EXCEPTION 'Proceso con firmas/evidencias requiere resolución posterior explícita';
 END IF;
 UPDATE public.procesos_firma SET estado='CANCELADO',cancelado_at=now(),cancelado_por=actor,motivo_cancelacion=btrim(p_motivo),updated_at=now() WHERE id=p_proceso;
 UPDATE public.contratos SET estado='BORRADOR' WHERE id=cid;
 -- Documento PARA_FIRMA/GENERADO conservado: cancelar proceso no anula su contenido.
END $$;

-- Triggers invoker: current_user distingue RPC del propietario frente a escrituras directas.
-- No usar GUCs modificables por clientes como autorización. El propietario/superusuario
-- sigue siendo autoridad de mantenimiento y puede deshabilitar triggers: fuera de este límite.
CREATE FUNCTION firma_privada.es_propietario_rpc() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT current_user = pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.iniciar_proceso_firma(uuid,uuid,text,uuid)'::regprocedure
$$;
CREATE FUNCTION firma_privada.proteger_proceso() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cid uuid;
BEGIN
 IF NOT firma_privada.es_propietario_rpc() THEN RAISE EXCEPTION 'Escritura de firma solo mediante RPC' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se elimina auditoría de firma'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT contrato_id INTO cid FROM public.documentos_contrato WHERE id=NEW.documento_origen_id;
  IF cid IS DISTINCT FROM NEW.contrato_id OR NEW.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'Proceso inconsistente'; END IF;
 ELSE
  IF OLD.estado<>'PENDIENTE' OR NEW.estado<>'CANCELADO'
   OR (to_jsonb(OLD)-ARRAY['estado','cancelado_at','cancelado_por','motivo_cancelacion','updated_at']) IS DISTINCT FROM
      (to_jsonb(NEW)-ARRAY['estado','cancelado_at','cancelado_por','motivo_cancelacion','updated_at']) THEN
   RAISE EXCEPTION 'Solo cancelación controlada en etapa 1; identidad del proceso inmutable';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_proceso BEFORE INSERT OR UPDATE OR DELETE ON public.procesos_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_proceso();
CREATE FUNCTION firma_privada.proteger_firmante() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE part public.partes_contrato%ROWTYPE; process public.procesos_firma%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' OR NOT firma_privada.es_propietario_rpc() THEN RAISE EXCEPTION 'Firmantes congelados; registro de firma no habilitado en etapa 1'; END IF;
 SELECT * INTO process FROM public.procesos_firma WHERE id=NEW.proceso_firma_id;
 SELECT * INTO part FROM public.partes_contrato WHERE id=NEW.parte_contrato_id;
 IF part.contrato_id IS DISTINCT FROM process.contrato_id OR NEW.rol IS DISTINCT FROM part.rol::text
 OR NEW.entidad_id IS DISTINCT FROM coalesce(part.persona_id,part.persona_moral_id)
 OR NEW.entidad_tipo IS DISTINCT FROM CASE WHEN part.persona_id IS NOT NULL THEN 'PERSONA' ELSE 'PERSONA_MORAL' END
 OR process.estado IS DISTINCT FROM 'PENDIENTE' OR NEW.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'Firmante ajeno/inconsistente'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_firmante BEFORE INSERT OR UPDATE OR DELETE ON public.firmantes_proceso FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_firmante();
CREATE FUNCTION firma_privada.proteger_evidencia() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Carga/registro de evidencias no habilitado en etapa 1';
END $$;
CREATE TRIGGER firma_2c_evidencia BEFORE INSERT OR UPDATE OR DELETE ON public.evidencias_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_evidencia();

CREATE FUNCTION firma_privada.proteger_contrato() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id) THEN RAISE EXCEPTION 'Contrato con historial de firma no eliminable'; END IF;
  RETURN OLD;
 END IF;
 -- Congela datos contractuales, no metadatos de futuras transiciones.
 IF OLD.estado::text<>'BORRADOR' AND
 ROW(OLD.id,OLD.solicitud_id,OLD.unidad_id,OLD.folio,OLD.fecha_inicio,OLD.fecha_fin,OLD.renta,OLD.deposito,OLD.dia_pago,OLD.arrendador_persona_moral_id,OLD.fecha_firma,OLD.lugar_firma,OLD.costo_lavanderia,OLD.domicilio_arrendador,OLD.domicilio_arrendatario,OLD.domicilio_fiador,OLD.created_at)
 IS DISTINCT FROM
 ROW(NEW.id,NEW.solicitud_id,NEW.unidad_id,NEW.folio,NEW.fecha_inicio,NEW.fecha_fin,NEW.renta,NEW.deposito,NEW.dia_pago,NEW.arrendador_persona_moral_id,NEW.fecha_firma,NEW.lugar_firma,NEW.costo_lavanderia,NEW.domicilio_arrendador,NEW.domicilio_arrendatario,NEW.domicilio_fiador,NEW.created_at) THEN
  RAISE EXCEPTION 'Condiciones congeladas fuera de BORRADOR';
 END IF;
 -- FIRMADO -> ACTIVO no se bloquea aquí cuando solo cambia estado/updated_at.
 -- La autorización y precondiciones de activación pertenecerán a su futura RPC.
 IF OLD.estado IS DISTINCT FROM NEW.estado THEN
  IF NEW.estado::text='PENDIENTE_FIRMA' THEN
   IF OLD.estado::text<>'BORRADOR' OR NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='PENDIENTE') THEN RAISE EXCEPTION 'Inicio de firma requiere proceso atómico'; END IF;
  ELSIF OLD.estado::text='PENDIENTE_FIRMA' THEN
   IF NEW.estado::text<>'BORRADOR' OR EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='PENDIENTE')
    OR NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='CANCELADO') THEN RAISE EXCEPTION 'Solo cancelación controlada disponible'; END IF;
  ELSIF OLD.estado::text='BORRADOR' AND NEW.estado::text IN('FIRMADO','ACTIVO') THEN
   RAISE EXCEPTION 'No se permite omitir el proceso de firma';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_contrato BEFORE UPDATE OR DELETE ON public.contratos FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_contrato();
CREATE FUNCTION firma_privada.proteger_parte() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid; state text;
BEGIN
 -- Una escritura directa puede tener ya lock de parte. NOWAIT en el padre
 -- evita inversión parte -> contrato frente a RPCs que toman contrato -> parte.
 FOR cid IN SELECT DISTINCT x FROM unnest(ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.contrato_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.contrato_id END]) x WHERE x IS NOT NULL ORDER BY x LOOP
  SELECT estado INTO state FROM public.contratos WHERE id=cid FOR UPDATE NOWAIT;
  IF state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Partes congeladas fuera de BORRADOR'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_parte BEFORE INSERT OR UPDATE OR DELETE ON public.partes_contrato FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_parte();
CREATE FUNCTION firma_privada.proteger_documento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE state text;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT estado INTO state FROM public.contratos WHERE id=NEW.contrato_id FOR UPDATE NOWAIT;
  IF state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Nuevas revisiones solo en BORRADOR'; END IF;
  RETURN NEW;
 END IF;
 -- UPDATE directo/service_role puede tener ya lock de documento. No esperar
 -- al contrato en orden inverso: fallar 55P03 y reintentar la operación completa.
 PERFORM 1 FROM public.contratos WHERE id=OLD.contrato_id FOR UPDATE NOWAIT;
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE documento_origen_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Documento origen inmutable'; END IF;
  IF (to_jsonb(OLD)-ARRAY['tipo','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['tipo','updated_at'])
    OR NEW.tipo::text<>'PARA_FIRMA' OR OLD.tipo::text NOT IN('BORRADOR','PARA_FIRMA') THEN
   RAISE EXCEPTION 'Documento origen inmutable';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_documento BEFORE INSERT OR UPDATE OR DELETE ON public.documentos_contrato FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_documento();

-- Consistencia al COMMIT: no dejar proceso pendiente con contrato editable ni al revés.
CREATE FUNCTION firma_privada.comprobar_transicion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $
DECLARE cid uuid; state text; amount integer; process uuid;
BEGIN
 IF TG_TABLE_NAME='contratos' THEN cid:=NEW.id; ELSE cid:=NEW.contrato_id; END IF;
 SELECT estado INTO state FROM public.contratos WHERE id=cid;
 SELECT count(*) INTO amount FROM public.procesos_firma WHERE contrato_id=cid AND estado='PENDIENTE';
 IF (state='PENDIENTE_FIRMA' AND amount<>1) OR (state IS DISTINCT FROM 'PENDIENTE_FIRMA' AND amount<>0) THEN
  RAISE EXCEPTION 'Proceso y estado contractual deben cambiar atómicamente';
 END IF;
 IF amount=1 THEN
  SELECT id INTO process FROM public.procesos_firma WHERE contrato_id=cid AND estado='PENDIENTE';
  IF (SELECT count(*) FROM public.firmantes_proceso WHERE proceso_firma_id=process)<2 THEN RAISE EXCEPTION 'Proceso sin firmantes completos'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.procesos_firma p JOIN public.documentos_contrato d ON d.id=p.documento_origen_id WHERE p.id=process AND d.contrato_id=cid AND d.tipo::text='PARA_FIRMA') THEN RAISE EXCEPTION 'Documento origen inconsistente'; END IF;
 END IF;
 RETURN NULL;
END $;
CREATE CONSTRAINT TRIGGER firma_2c_transicion_proceso AFTER INSERT OR UPDATE ON public.procesos_firma DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();
CREATE CONSTRAINT TRIGGER firma_2c_transicion_contrato AFTER UPDATE ON public.contratos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();

-- Lectura administrativa; escrituras solo RPC. RLS no basta frente a service_role,
-- por eso se revocan también sus DML directos y existen triggers de integridad.
ALTER TABLE public.procesos_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firmantes_proceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias_firma ENABLE ROW LEVEL SECURITY;
CREATE POLICY procesos_firma_admin_lectura ON public.procesos_firma FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE POLICY firmantes_proceso_admin_lectura ON public.firmantes_proceso FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
CREATE POLICY evidencias_firma_admin_lectura ON public.evidencias_firma FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
REVOKE ALL ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma TO authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.firma_fuentes_para_verificar(uuid),public.registrar_validacion_documento_firma(uuid,uuid,uuid,text,jsonb,jsonb),public.iniciar_proceso_firma(uuid,uuid,text,uuid),public.cancelar_proceso_firma(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.firma_fuentes_para_verificar(uuid),public.registrar_validacion_documento_firma(uuid,uuid,uuid,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_proceso_firma(uuid,uuid,text,uuid),public.cancelar_proceso_firma(uuid,text) TO authenticated;
COMMIT;
