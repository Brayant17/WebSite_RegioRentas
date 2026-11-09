-- 2C ETAPA 2 — FIRMA AUTÓGRAFA CON REGISTRO DIGITAL POR ADMINISTRADOR. VERSIÓN FINAL PARA REVISIÓN.
-- NO ejecutar desde frontend/CI. NO aplicada en Supabase.
-- Requiere 02_infraestructura_corregida.sql instalado y sin modificar (el preflight lo comprueba).
-- Antes: 05_etapa2_verificaciones_solo_lectura.sql y la sección P de 06_etapa2_storage_controles_solo_lectura.sql.
-- Instalación única, no idempotente. Diseño y riesgos: docs/firmas-2c-etapa2-diseno.md.
-- Storage: SOLO LECTURA de storage.objects (propiedad de supabase_storage_admin). Este archivo no crea políticas,
-- triggers ni bloqueos en el esquema storage; la protección del bucket se configura en el panel (ver diseño).
--
-- Flujo: el administrador comprueba en persona la identidad de cada firmante y registra su firma con la
-- fecha declarada (registrar_firma_firmante); el servidor reserva una ruta (reservar_evidencia_firma), sube
-- el PDF firmado escaneado y lo registra con la declaración del administrador (registrar_evidencia_firma);
-- el administrador completa eligiendo una evidencia (completar_proceso_firma) y el contrato pasa a FIRMADO.
-- Con firmas parciales, el proceso no se cancela: se anula (anular_proceso_firma) conservando todo.
-- Todas las escrituras siguen siendo exclusivas de RPC.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $preflight$
DECLARE v_fn text;
 -- md5 del cuerpo (prosrc) instalado por 02, normalizando CRLF -> LF: el SQL Editor de Supabase
 -- puede guardar CRLF (ver el hallazgo del hash de la plantilla V2).
 v_expected jsonb:='{
  "firma_privada.admin_actual()": "db2646f5e7f5ced355d3337cf7127cf0",
  "firma_privada.cobertura(uuid)": "51956f1dd72708294ffad6d34e929b9f",
  "firma_privada.proteger_proceso()": "359f22c73e9e77e089a3990eec91f61c",
  "firma_privada.proteger_firmante()": "e6db4112d6b6d1aba9a225d19f6c69fd",
  "firma_privada.proteger_evidencia()": "b09124d8bed47a44e784473b1f8bc7d3",
  "firma_privada.proteger_contrato()": "84bebcb4ec33a88251f2c3d698ad83b7",
  "firma_privada.comprobar_transicion()": "4ea2e0df939a094d47a4635548416fec",
  "public.iniciar_proceso_firma(uuid,uuid,text,uuid)": "aeac70b77e73f3d2eea5895e2641a52d",
  "public.cancelar_proceso_firma(uuid,text)": "ffd8733b8a332bd2990a0a21704ffdee"
 }';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Instalar con el mismo propietario confiable BYPASSRLS que la etapa 1';
 END IF;
 IF current_user IN('anon','authenticated','service_role','authenticator') THEN RAISE EXCEPTION 'Rol de instalación no permitido'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role','authenticator']) r(rol)
  WHERE to_regrole(r.rol) IS NOT NULL AND pg_has_role(r.rol,current_user,'MEMBER')) THEN
  RAISE EXCEPTION 'Un rol cliente es miembro del rol instalador: no se instala';
 END IF;
 IF to_regnamespace('firma_privada') IS NULL OR to_regclass('public.procesos_firma') IS NULL
  OR to_regclass('public.firmantes_proceso') IS NULL OR to_regclass('public.evidencias_firma') IS NULL THEN
  RAISE EXCEPTION 'Falta la etapa 1 de 2C (02_infraestructura_corregida.sql)';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   AND p.proname IN('registrar_firma_firmante','reservar_evidencia_firma','registrar_evidencia_firma','completar_proceso_firma',
    'anular_proceso_firma','listar_reservas_evidencia_vencidas','marcar_reserva_evidencia_limpiada'))
  OR to_regclass('firma_privada.reservas_evidencia') IS NOT NULL
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
   AND ((table_name='procesos_firma' AND column_name IN('completado_por','evidencia_firmada_id','sha256_documento_firmado',
     'anulado_at','anulado_por','motivo_anulacion','destino_contrato_anulacion'))
    OR (table_name='firmantes_proceso' AND column_name IN('registrado_at','verificacion_identidad'))
    OR (table_name='evidencias_firma' AND column_name IN('declaracion_version','declaracion_texto','storage_object_id','storage_etag')))) THEN
  RAISE EXCEPTION 'La etapa 2 de 2C ya está instalada (total o parcialmente): no se reemplaza';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
   AND c.relname IN('contratos','procesos_firma','firmantes_proceso','evidencias_firma') AND pg_get_userbyid(c.relowner)<>current_user)
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='firma_privada' AND pg_get_userbyid(p.proowner)<>current_user) THEN
  RAISE EXCEPTION 'El instalador debe ser propietario de las tablas 2C, de contratos y de las funciones de firma_privada';
 END IF;
 FOR v_fn IN SELECT jsonb_object_keys(v_expected) LOOP
  IF (SELECT md5(replace(prosrc,E'\r','')) FROM pg_proc WHERE oid=to_regprocedure(v_fn)) IS DISTINCT FROM v_expected->>v_fn THEN
   RAISE EXCEPTION 'La función % no coincide con la etapa 1 revisada: requiere conciliación antes de instalar',v_fn;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND tgname IN('firma_2c_proceso','firma_2c_firmante',
   'firma_2c_evidencia','firma_2c_contrato','firma_2c_transicion_proceso','firma_2c_transicion_firmante','firma_2c_transicion_contrato'))<>7 THEN
  RAISE EXCEPTION 'Faltan triggers habilitados de la etapa 1';
 END IF;
 -- Los dos CHECK de estado de procesos_firma de la etapa 1 (nombres generados por PostgreSQL) se sustituyen
 -- para admitir ANULADO. Se localizan por definición: deben ser exactamente esos dos.
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%CANCELADO%')<>2
  OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%CANCELADO%' AND pg_get_constraintdef(oid) LIKE '%motivo_cancelacion%')<>1 THEN
  RAISE EXCEPTION 'Los CHECK de estado de procesos_firma no son los de la etapa 1: requiere conciliación';
 END IF;
 -- La etapa 1 no puede haber producido firmas, evidencias ni procesos completados.
 IF EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE estado<>'PENDIENTE') OR EXISTS(SELECT 1 FROM public.evidencias_firma)
  OR EXISTS(SELECT 1 FROM public.procesos_firma WHERE estado='COMPLETADO') THEN
  RAISE EXCEPTION 'Existen firmas, evidencias o procesos completados previos: requieren conciliación';
 END IF;
 -- La evidencia se contrasta con el objeto real del bucket privado (solo lectura).
 IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN RAISE EXCEPTION 'Falta el esquema storage'; END IF;
 IF NOT has_table_privilege(current_user,'storage.objects','SELECT') OR NOT has_table_privilege(current_user,'storage.buckets','SELECT') THEN
  RAISE EXCEPTION 'El instalador no puede leer storage.objects/storage.buckets';
 END IF;
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects'
   AND ((column_name IN('bucket_id','name') AND data_type='text') OR (column_name='metadata' AND data_type='jsonb')
    OR (column_name='id' AND data_type='uuid') OR (column_name='created_at' AND data_type='timestamp with time zone')))<>5 THEN
  RAISE EXCEPTION 'storage.objects sin id/bucket_id/name/metadata/created_at con los tipos esperados';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='contract-documents' AND public IS FALSE) THEN
  RAISE EXCEPTION 'El bucket contract-documents no existe o no es privado';
 END IF;
END $preflight$;

-- ---------------------------------------------------------------- columnas y restricciones
-- Proceso: quién completó y con qué evidencia (FK compuesta: la evidencia es de ESTE proceso y el hash
-- guardado es el suyo) y, para la anulación, quién, cuándo, por qué y a qué estado pasó el contrato.
ALTER TABLE public.procesos_firma
 ADD COLUMN completado_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 ADD COLUMN evidencia_firmada_id uuid,
 ADD COLUMN sha256_documento_firmado text CHECK(sha256_documento_firmado ~ '^[0-9a-f]{64}$'),
 ADD COLUMN anulado_at timestamptz,
 ADD COLUMN anulado_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 ADD COLUMN motivo_anulacion text,
 ADD COLUMN destino_contrato_anulacion text;

DO $checks$
DECLARE v_name text;
BEGIN
 FOR v_name IN SELECT conname FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
  AND pg_get_constraintdef(oid) LIKE '%CANCELADO%' LOOP
  EXECUTE format('ALTER TABLE public.procesos_firma DROP CONSTRAINT %I',v_name);
 END LOOP;
END $checks$;

-- Mismas reglas de la etapa 1 para PENDIENTE/COMPLETADO/CANCELADO, más ANULADO.
ALTER TABLE public.procesos_firma
 ADD CONSTRAINT procesos_firma_2c2_estado CHECK(estado IN('PENDIENTE','COMPLETADO','CANCELADO','ANULADO')),
 ADD CONSTRAINT procesos_firma_2c2_cierre CHECK(
  (completado_at IS NOT NULL)=(estado='COMPLETADO')
  AND (cancelado_at IS NOT NULL)=(estado='CANCELADO') AND (cancelado_por IS NOT NULL)=(estado='CANCELADO')
  AND (motivo_cancelacion IS NOT NULL)=(estado='CANCELADO') AND (estado<>'CANCELADO' OR nullif(btrim(motivo_cancelacion),'') IS NOT NULL)
  AND (anulado_at IS NOT NULL)=(estado='ANULADO') AND (anulado_por IS NOT NULL)=(estado='ANULADO')
  AND (motivo_anulacion IS NOT NULL)=(estado='ANULADO') AND (destino_contrato_anulacion IS NOT NULL)=(estado='ANULADO')
  AND (estado<>'ANULADO' OR (motivo_anulacion=btrim(motivo_anulacion) AND length(motivo_anulacion) BETWEEN 10 AND 1000
   AND destino_contrato_anulacion IN('BORRADOR','CANCELADO')))),
 ADD CONSTRAINT procesos_firma_2c2_completado CHECK(
  (estado='COMPLETADO')=(completado_por IS NOT NULL) AND (estado='COMPLETADO')=(evidencia_firmada_id IS NOT NULL)
  AND (estado='COMPLETADO')=(sha256_documento_firmado IS NOT NULL));

-- Firmante: firmado_at = fecha DECLARADA de la firma autógrafa; registrado_at = momento del registro digital
-- (servidor). verificacion_identidad = tipo de identificación cotejada en persona: ni número ni copia.
ALTER TABLE public.firmantes_proceso
 ADD COLUMN registrado_at timestamptz,
 ADD COLUMN verificacion_identidad text CHECK(verificacion_identidad IN('INE','PASAPORTE','CEDULA_PROFESIONAL','OTRA')),
 ADD CONSTRAINT firmantes_proceso_2c2_registro CHECK(
  (estado='PENDIENTE' AND registrado_at IS NULL AND verificacion_identidad IS NULL)
  OR (estado='FIRMADO' AND registrado_at IS NOT NULL AND verificacion_identidad IS NOT NULL AND firmado_at<=registrado_at));
COMMENT ON COLUMN public.firmantes_proceso.firmado_at IS 'Fecha y hora de la firma autógrafa DECLARADAS por el administrador que registra';
COMMENT ON COLUMN public.firmantes_proceso.registrado_at IS 'Fecha y hora del registro digital (reloj del servidor)';
COMMENT ON COLUMN public.firmantes_proceso.verificacion_identidad IS 'Tipo de identificación cotejada en persona; no se guarda número ni copia';

-- Reservas de ruta para evidencias: cada subida a Storage parte de una reserva (id de evidencia + ruta),
-- con caducidad. Permite distinguir objetos huérfanos y limpiarlos sin riesgo (ver diseño, "Huérfanos").
CREATE TABLE firma_privada.reservas_evidencia (
 id uuid PRIMARY KEY,
 proceso_firma_id uuid NOT NULL REFERENCES public.procesos_firma(id) ON DELETE RESTRICT,
 storage_path text NOT NULL UNIQUE,
 reservado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 reservado_at timestamptz NOT NULL,
 expira_at timestamptz NOT NULL,
 consumida_at timestamptz,
 limpiada_at timestamptz,
 CHECK(expira_at>reservado_at AND expira_at<=reservado_at+interval '1 hour'),
 CHECK(consumida_at IS NULL OR limpiada_at IS NULL),
 CHECK(limpiada_at IS NULL OR limpiada_at>expira_at)
);
CREATE INDEX reservas_evidencia_proceso_idx ON firma_privada.reservas_evidencia(proceso_firma_id);
CREATE INDEX reservas_evidencia_pendientes_idx ON firma_privada.reservas_evidencia(expira_at) WHERE consumida_at IS NULL;
CREATE INDEX reservas_evidencia_reservado_por_idx ON firma_privada.reservas_evidencia(reservado_por);

-- Evidencia: declaración expresa del administrador (versión + texto exacto aceptado) e identidad del
-- objeto de Storage (id y eTag) para detectar sustituciones. La tabla está vacía (preflight).
ALTER TABLE public.evidencias_firma
 ADD COLUMN declaracion_version text NOT NULL CHECK(declaracion_version='PDF_FIRMADO_CORRESPONDE_V1'),
 ADD COLUMN declaracion_texto text NOT NULL CHECK(btrim(declaracion_texto)<>''),
 ADD COLUMN storage_object_id uuid NOT NULL,
 ADD COLUMN storage_etag text,
 -- Un archivo firmado (por hash) solo puede ser evidencia una vez en todo el sistema.
 ADD CONSTRAINT evidencias_firma_sha256_un UNIQUE(sha256),
 ADD CONSTRAINT evidencias_firma_identidad_un UNIQUE(id,proceso_firma_id,sha256),
 ADD CONSTRAINT evidencias_firma_reserva_fk FOREIGN KEY(id) REFERENCES firma_privada.reservas_evidencia(id) ON DELETE RESTRICT;
ALTER TABLE public.procesos_firma
 ADD CONSTRAINT procesos_firma_evidencia_fk FOREIGN KEY(evidencia_firmada_id,id,sha256_documento_firmado)
  REFERENCES public.evidencias_firma(id,proceso_firma_id,sha256) ON DELETE RESTRICT;
CREATE UNIQUE INDEX procesos_firma_un_completado ON public.procesos_firma(contrato_id) WHERE estado='COMPLETADO';
CREATE INDEX procesos_firma_evidencia_idx ON public.procesos_firma(evidencia_firmada_id);
CREATE INDEX procesos_firma_sha_origen_idx ON public.procesos_firma(sha256_documento_origen);
CREATE INDEX procesos_firma_storage_origen_idx ON public.procesos_firma(storage_path_origen);
CREATE INDEX procesos_firma_completado_por_idx ON public.procesos_firma(completado_por);
CREATE INDEX procesos_firma_anulado_por_idx ON public.procesos_firma(anulado_por);
CREATE INDEX evidencias_firma_uploaded_by_idx ON public.evidencias_firma(uploaded_by);
CREATE INDEX firmantes_proceso_registrado_por_idx ON public.firmantes_proceso(registrado_por);

-- ---------------------------------------------------------------- auxiliares privadas
CREATE FUNCTION firma_privada.ruta_evidencia(p_contrato uuid,p_proceso uuid,p_evidencia uuid) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT p_contrato::text||'/firmas/'||p_proceso::text||'/'||p_evidencia::text||'/firmado.pdf'
$$;
-- Texto exacto que el administrador acepta al registrar la evidencia; se guarda literal en la fila.
CREATE FUNCTION firma_privada.declaracion_evidencia(p_version text,p_sha256_origen text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_version='PDF_FIRMADO_CORRESPONDE_V1' AND p_sha256_origen ~ '^[0-9a-f]{64}$' THEN
  'Declaro que el archivo PDF registrado corresponde al documento origen de este proceso de firma (SHA-256 del PDF origen: '
  ||p_sha256_origen||'): es la digitalización íntegra de ese documento con las firmas autógrafas recabadas, sin páginas añadidas, omitidas ni alteradas.'
 END
$$;
-- Objeto del bucket privado con el tamaño y tipo declarados (solo lectura: no bloquea filas de una tabla que
-- pertenece a supabase_storage_admin). Storage no guarda SHA-256: el hash lo calcula el servidor sobre los bytes
-- que él mismo sube; id + eTag identifican la versión exacta del objeto. NULL si no existe o no coincide.
CREATE FUNCTION firma_privada.objeto_pdf(p_path text,p_bytes bigint) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'etag',o.metadata->>'eTag','created_at',o.created_at) FROM storage.objects o
 WHERE o.bucket_id='contract-documents' AND o.name=p_path
  AND o.metadata->>'mimetype'='application/pdf' AND o.metadata->>'size'=p_bytes::text
$$;

-- ---------------------------------------------------------------- triggers (lista blanca ampliada)
-- Se mantiene el criterio de 02: solo el propietario (RPC SECURITY DEFINER) escribe; las escrituras directas
-- de clientes siguen rechazadas. Se añaden únicamente: PENDIENTE->COMPLETADO y PENDIENTE->ANULADO (proceso),
-- PENDIENTE->FIRMADO (firmante), alta de evidencia, PENDIENTE_FIRMA->FIRMADO y PENDIENTE_FIRMA->CANCELADO
-- (contrato, este último solo tras una anulación), cada una con sus invariantes comprobadas aquí también.
CREATE OR REPLACE FUNCTION firma_privada.proteger_proceso() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_mutable text[]:=ARRAY['estado','completado_at','completado_por','evidencia_firmada_id','sha256_documento_firmado',
 'cancelado_at','cancelado_por','motivo_cancelacion','anulado_at','anulado_por','motivo_anulacion','destino_contrato_anulacion','updated_at'];
 v_signed boolean; v_evidence boolean;
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
  -- Un PDF con firmas parciales anuladas no vuelve a circular: el nuevo proceso exige otra revisión.
  IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE estado='ANULADO'
   AND (documento_origen_id=NEW.documento_origen_id OR sha256_documento_origen=NEW.sha256_documento_origen)) THEN
   RAISE EXCEPTION 'El documento origen pertenece a un proceso anulado: genera una nueva revisión';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'Proceso cerrado (%): inmutable',OLD.estado; END IF;
 IF (to_jsonb(OLD)-v_mutable) IS DISTINCT FROM (to_jsonb(NEW)-v_mutable) THEN RAISE EXCEPTION 'Identidad del proceso inmutable'; END IF;
 v_signed:=EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=OLD.id AND estado<>'PENDIENTE');
 v_evidence:=EXISTS(SELECT 1 FROM public.evidencias_firma WHERE proceso_firma_id=OLD.id);
 IF NEW.estado='CANCELADO' THEN
  IF v_signed OR v_evidence THEN RAISE EXCEPTION 'Proceso con firmas/evidencias: no se cancela'; END IF;
 ELSIF NEW.estado='ANULADO' THEN
  IF NOT (v_signed OR v_evidence) THEN RAISE EXCEPTION 'Proceso sin firmas ni evidencias: se cancela, no se anula'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.anulado_por AND role='admin') THEN
   RAISE EXCEPTION 'La anulación requiere administrador' USING ERRCODE='42501';
  END IF;
 ELSIF NEW.estado='COMPLETADO' THEN
  IF NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=OLD.id)
   OR EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=OLD.id AND estado<>'FIRMADO') THEN
   RAISE EXCEPTION 'No se completa: faltan firmas registradas';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.evidencias_firma WHERE id=NEW.evidencia_firmada_id AND proceso_firma_id=OLD.id AND sha256=NEW.sha256_documento_firmado) THEN
   RAISE EXCEPTION 'No se completa: evidencia ajena o inexistente';
  END IF;
 ELSE
  RAISE EXCEPTION 'Transición de proceso no permitida: % -> %',OLD.estado,NEW.estado;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION firma_privada.proteger_firmante() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_part public.partes_contrato%ROWTYPE; v_process public.procesos_firma%ROWTYPE;
 v_mutable text[]:=ARRAY['estado','firmado_at','registrado_por','registrado_at','verificacion_identidad','updated_at'];
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Firmantes congelados: escritura solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se elimina auditoría de firma'; END IF;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=NEW.proceso_firma_id;
 IF TG_OP='INSERT' THEN
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
 END IF;
 -- UPDATE: único registro PENDIENTE -> FIRMADO; identidad y snapshot inmutables.
 IF OLD.estado<>'PENDIENTE' OR NEW.estado<>'FIRMADO' OR (to_jsonb(OLD)-v_mutable) IS DISTINCT FROM (to_jsonb(NEW)-v_mutable) THEN
  RAISE EXCEPTION 'Firmante: solo un registro PENDIENTE -> FIRMADO; identidad inmutable';
 END IF;
 IF v_process.estado IS DISTINCT FROM 'PENDIENTE' THEN RAISE EXCEPTION 'Firma solo en procesos pendientes'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.registrado_por AND role='admin') THEN
  RAISE EXCEPTION 'El registro de firma requiere administrador' USING ERRCODE='42501';
 END IF;
 IF NEW.firmado_at<v_process.iniciado_at OR NEW.firmado_at>NEW.registrado_at THEN RAISE EXCEPTION 'Fecha de firma fuera del proceso'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION firma_privada.proteger_evidencia() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_process public.procesos_firma%ROWTYPE; v_state text; v_reserve firma_privada.reservas_evidencia%ROWTYPE;
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Evidencias de firma: alta solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Evidencias de firma inmutables'; END IF;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=NEW.proceso_firma_id;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_process.contrato_id;
 IF v_process.estado IS DISTINCT FROM 'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN
  RAISE EXCEPTION 'Evidencia solo para procesos pendientes';
 END IF;
 IF NEW.storage_path IS DISTINCT FROM firma_privada.ruta_evidencia(v_process.contrato_id,v_process.id,NEW.id) THEN
  RAISE EXCEPTION 'Ruta de evidencia no canónica';
 END IF;
 SELECT * INTO v_reserve FROM firma_privada.reservas_evidencia WHERE id=NEW.id;
 IF v_reserve.proceso_firma_id IS DISTINCT FROM NEW.proceso_firma_id OR v_reserve.storage_path IS DISTINCT FROM NEW.storage_path
  OR v_reserve.reservado_por IS DISTINCT FROM NEW.uploaded_by OR v_reserve.consumida_at IS NOT NULL OR v_reserve.limpiada_at IS NOT NULL
  OR v_reserve.expira_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Evidencia sin reserva vigente';
 END IF;
 IF NEW.declaracion_texto IS DISTINCT FROM firma_privada.declaracion_evidencia(NEW.declaracion_version,v_process.sha256_documento_origen) THEN
  RAISE EXCEPTION 'Declaración de correspondencia inválida';
 END IF;
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE sha256_documento_origen=NEW.sha256) THEN
  RAISE EXCEPTION 'La evidencia es un documento origen sin firmar';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.uploaded_by AND role='admin') THEN
  RAISE EXCEPTION 'La evidencia requiere administrador' USING ERRCODE='42501';
 END IF;
 IF (SELECT count(*) FROM public.evidencias_firma WHERE proceso_firma_id=NEW.proceso_firma_id)>=5 THEN
  RAISE EXCEPTION 'Límite de evidencias por proceso alcanzado (5)';
 END IF;
 RETURN NEW;
END $$;

-- Reservas: alta en la ruta canónica; después solo se marcan una vez como consumidas o limpiadas.
CREATE FUNCTION firma_privada.proteger_reserva() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Reservas de evidencia: escritura solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se eliminan reservas de evidencia'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.consumida_at IS NOT NULL OR NEW.limpiada_at IS NOT NULL OR NEW.storage_path IS DISTINCT FROM
   firma_privada.ruta_evidencia((SELECT contrato_id FROM public.procesos_firma WHERE id=NEW.proceso_firma_id),NEW.proceso_firma_id,NEW.id) THEN
   RAISE EXCEPTION 'Reserva de evidencia inconsistente';
  END IF;
  RETURN NEW;
 END IF;
 IF (to_jsonb(OLD)-ARRAY['consumida_at','limpiada_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['consumida_at','limpiada_at'])
  OR (OLD.consumida_at IS NOT NULL AND NEW.consumida_at IS DISTINCT FROM OLD.consumida_at)
  OR (OLD.limpiada_at IS NOT NULL AND NEW.limpiada_at IS DISTINCT FROM OLD.limpiada_at) THEN
  RAISE EXCEPTION 'Reserva: solo se marca una vez como consumida o limpiada';
 END IF;
 IF NEW.consumida_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.evidencias_firma WHERE id=NEW.id) THEN
  RAISE EXCEPTION 'Reserva consumida sin evidencia';
 END IF;
 IF NEW.limpiada_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.evidencias_firma WHERE id=NEW.id) THEN
  RAISE EXCEPTION 'Reserva con evidencia: no se limpia';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_reserva BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.reservas_evidencia FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_reserva();

CREATE OR REPLACE FUNCTION firma_privada.proteger_contrato() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old text; v_new text; v_last public.procesos_firma%ROWTYPE;
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
   OR (v_old='PENDIENTE_FIRMA' AND v_new IN('BORRADOR','FIRMADO','CANCELADO'))
   OR (v_old='FIRMADO' AND v_new='ACTIVO')
   OR (v_old='ACTIVO' AND v_new IN('FINALIZADO','TERMINADO_ANTICIPADAMENTE'))) THEN
   RAISE EXCEPTION 'Transición de contrato no permitida: % -> %',v_old,v_new;
  END IF;
  IF v_new='PENDIENTE_FIRMA' AND NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='PENDIENTE') THEN
   RAISE EXCEPTION 'Inicio de firma requiere proceso atómico';
  END IF;
  IF v_old='PENDIENTE_FIRMA' THEN
   IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='PENDIENTE') THEN
    RAISE EXCEPTION 'Solo cancelación, anulación o completado controlados disponibles';
   END IF;
   -- El proceso que se acaba de cerrar en esta transacción es el más reciente del contrato.
   SELECT * INTO v_last FROM public.procesos_firma WHERE contrato_id=OLD.id ORDER BY iniciado_at DESC,id DESC LIMIT 1;
   IF v_new='FIRMADO' AND v_last.estado IS DISTINCT FROM 'COMPLETADO' THEN
    RAISE EXCEPTION 'FIRMADO requiere un proceso de firma completado';
   END IF;
   IF v_new='CANCELADO' AND (v_last.estado IS DISTINCT FROM 'ANULADO' OR v_last.destino_contrato_anulacion IS DISTINCT FROM 'CANCELADO') THEN
    RAISE EXCEPTION 'PENDIENTE_FIRMA -> CANCELADO solo mediante anulación del proceso';
   END IF;
   IF v_new='BORRADOR' AND (v_last.estado='COMPLETADO' OR EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=OLD.id AND estado='COMPLETADO')) THEN
    RAISE EXCEPTION 'Contrato con proceso completado no vuelve a BORRADOR';
   END IF;
   IF v_new='BORRADOR' AND v_last.estado='ANULADO' AND v_last.destino_contrato_anulacion IS DISTINCT FROM 'BORRADOR' THEN
    RAISE EXCEPTION 'El contrato debe pasar al destino registrado en la anulación';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

-- Consistencia al COMMIT (también para escrituras del propietario fuera de RPC).
CREATE OR REPLACE FUNCTION firma_privada.comprobar_transicion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 -- Etapa 2: un proceso completado implica contrato firmado (o posterior), todas las firmas y su evidencia;
 -- un contrato FIRMADO con historial 2C debe tener su proceso completado; un proceso cancelado no tiene
 -- firmas ni evidencias y uno anulado sí (si no, debió cancelarse).
 IF EXISTS(SELECT 1 FROM public.procesos_firma p WHERE p.contrato_id=v_cid AND p.estado='COMPLETADO' AND (
    v_state IN('BORRADOR','PENDIENTE_FIRMA','CANCELADO')
    OR EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.estado<>'FIRMADO')
    OR NOT EXISTS(SELECT 1 FROM public.evidencias_firma e WHERE e.id=p.evidencia_firmada_id AND e.proceso_firma_id=p.id AND e.sha256=p.sha256_documento_firmado)))
  OR (v_state='FIRMADO' AND EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=v_cid)
    AND NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=v_cid AND estado='COMPLETADO'))
  OR EXISTS(SELECT 1 FROM public.procesos_firma p WHERE p.contrato_id=v_cid AND p.estado='CANCELADO'
    AND (EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.estado<>'PENDIENTE')
     OR EXISTS(SELECT 1 FROM public.evidencias_firma e WHERE e.proceso_firma_id=p.id)))
  OR EXISTS(SELECT 1 FROM public.procesos_firma p WHERE p.contrato_id=v_cid AND p.estado='ANULADO'
    AND NOT EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.estado<>'PENDIENTE')
    AND NOT EXISTS(SELECT 1 FROM public.evidencias_firma e WHERE e.proceso_firma_id=p.id)) THEN
  RAISE EXCEPTION 'Proceso de firma completado/cancelado/anulado inconsistente con contrato, firmas o evidencia';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER firma_2c_transicion_firmante_registro AFTER UPDATE ON public.firmantes_proceso DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();
CREATE CONSTRAINT TRIGGER firma_2c_transicion_evidencia AFTER INSERT ON public.evidencias_firma DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_transicion();

-- ---------------------------------------------------------------- RPC
-- Orden de bloqueo común a todas las RPC de firma (también iniciar/cancelar de la etapa 1):
--   contrato FOR UPDATE -> proceso FOR UPDATE -> firmantes (ORDER BY id) -> reserva -> evidencia.
-- storage.objects solo se lee (sin bloqueo): ninguna RPC espera por Storage ni Storage por ellas.
-- Bloquear primero el contrato serializa todas las operaciones de firma de un mismo contrato. Cada RPC es una
-- sola transacción: cualquier error revierte todo. Sin SQL dinámico y con search_path vacío.

-- 1. Verificación de identidad y firma autógrafa de un firmante (admin con sesión propia).
-- p_sha256_documento_origen: hash del PDF que el administrador tiene a la vista/impreso; evita registrar firmas
-- sobre otra revisión. p_firmado_at: fecha y hora DECLARADAS de la firma (obligatoria); registrado_at = servidor.
CREATE FUNCTION public.registrar_firma_firmante(p_proceso uuid,p_firmante uuid,p_sha256_documento_origen text,
 p_verificacion_identidad text,p_firmado_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_actor uuid:=firma_privada.admin_actual(); v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE;
 v_signer public.firmantes_proceso%ROWTYPE; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_verificacion_identidad IS NULL OR p_verificacion_identidad NOT IN('INE','PASAPORTE','CEDULA_PROFESIONAL','OTRA') THEN
  RAISE EXCEPTION 'Tipo de identificación verificada inválido';
 END IF;
 IF p_firmado_at IS NULL THEN RAISE EXCEPTION 'Fecha declarada de firma obligatoria'; END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF p_sha256_documento_origen IS DISTINCT FROM v_process.sha256_documento_origen THEN
  RAISE EXCEPTION 'El documento no corresponde al documento origen del proceso';
 END IF;
 SELECT * INTO v_signer FROM public.firmantes_proceso WHERE id=p_firmante FOR UPDATE;
 IF NOT FOUND OR v_signer.proceso_firma_id IS DISTINCT FROM p_proceso THEN RAISE EXCEPTION 'Firmante ajeno al proceso o inexistente'; END IF;
 IF v_signer.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'Firma ya registrada para este firmante'; END IF;
 IF p_firmado_at<v_process.iniciado_at OR p_firmado_at>v_now THEN RAISE EXCEPTION 'Fecha de firma fuera del proceso (entre el inicio y ahora)'; END IF;
 UPDATE public.firmantes_proceso SET estado='FIRMADO',firmado_at=p_firmado_at,registrado_por=v_actor,registrado_at=v_now,
  verificacion_identidad=p_verificacion_identidad,updated_at=v_now WHERE id=p_firmante;
END $$;

-- 2a. Reserva de ruta para una evidencia. EXECUTE solo service_role: el servidor autentica al administrador
-- (p_actor) y, con la ruta devuelta, sube el PDF con upsert=false antes de que venza (15 min).
-- Como máximo 5 evidencias registradas + reservas vigentes por proceso.
CREATE FUNCTION public.reservar_evidencia_firma(p_actor uuid,p_proceso uuid)
RETURNS TABLE(evidencia_id uuid,ruta_storage text,vence_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE; v_id uuid:=gen_random_uuid();
 v_now timestamptz:=clock_timestamp(); v_path text;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND role='admin') THEN
  RAISE EXCEPTION 'Administrador inválido' USING ERRCODE='42501';
 END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF (SELECT count(*) FROM public.evidencias_firma e WHERE e.proceso_firma_id=p_proceso)
  +(SELECT count(*) FROM firma_privada.reservas_evidencia r WHERE r.proceso_firma_id=p_proceso
    AND r.consumida_at IS NULL AND r.limpiada_at IS NULL AND r.expira_at>v_now)>=5 THEN
  RAISE EXCEPTION 'Límite de evidencias por proceso alcanzado (5, incluidas las reservas vigentes)';
 END IF;
 v_path:=firma_privada.ruta_evidencia(v_cid,p_proceso,v_id);
 INSERT INTO firma_privada.reservas_evidencia(id,proceso_firma_id,storage_path,reservado_por,reservado_at,expira_at)
 VALUES(v_id,p_proceso,v_path,p_actor,v_now,v_now+interval '15 minutes');
 RETURN QUERY SELECT v_id,v_path,v_now+interval '15 minutes';
END $$;

-- 2b. Registro de la evidencia (PDF firmado escaneado) con la declaración expresa del administrador.
-- EXECUTE solo service_role. El servidor valida y hashea los bytes que sube a la ruta reservada.
-- Reintento con el mismo id y los mismos datos = idempotente (devuelve el id).
CREATE FUNCTION public.registrar_evidencia_firma(p_actor uuid,p_proceso uuid,p_evidencia uuid,p_sha256 text,p_size_bytes bigint,
 p_mime_type text,p_declaracion_version text,p_confirma_correspondencia boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE; v_reserve firma_privada.reservas_evidencia%ROWTYPE;
 v_existing public.evidencias_firma%ROWTYPE; v_object jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND role='admin') THEN
  RAISE EXCEPTION 'Administrador inválido' USING ERRCODE='42501';
 END IF;
 IF p_evidencia IS NULL THEN RAISE EXCEPTION 'Identificador de evidencia obligatorio'; END IF;
 IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'SHA-256 inválido'; END IF;
 IF p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Tamaño de PDF inválido'; END IF;
 IF p_mime_type IS DISTINCT FROM 'application/pdf' THEN RAISE EXCEPTION 'Tipo de archivo inválido: se requiere application/pdf'; END IF;
 IF p_confirma_correspondencia IS NOT TRUE THEN
  RAISE EXCEPTION 'El administrador debe confirmar que el PDF corresponde al documento firmado';
 END IF;
 IF p_declaracion_version IS DISTINCT FROM 'PDF_FIRMADO_CORRESPONDE_V1' THEN RAISE EXCEPTION 'Versión de declaración no vigente'; END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 SELECT * INTO v_reserve FROM firma_privada.reservas_evidencia WHERE id=p_evidencia FOR UPDATE;
 SELECT * INTO v_existing FROM public.evidencias_firma WHERE id=p_evidencia;
 IF FOUND THEN
  IF v_existing.proceso_firma_id=p_proceso AND v_existing.sha256=p_sha256 AND v_existing.size_bytes=p_size_bytes
   AND v_existing.uploaded_by=p_actor AND v_existing.declaracion_version=p_declaracion_version THEN
   RETURN p_evidencia;
  END IF;
  RAISE EXCEPTION 'La evidencia ya está registrada con otros datos';
 END IF;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF v_reserve.id IS NULL OR v_reserve.proceso_firma_id IS DISTINCT FROM p_proceso OR v_reserve.reservado_por IS DISTINCT FROM p_actor THEN
  RAISE EXCEPTION 'Reserva de evidencia inexistente o ajena';
 END IF;
 IF v_reserve.consumida_at IS NOT NULL OR v_reserve.limpiada_at IS NOT NULL OR v_reserve.expira_at<=v_now THEN
  RAISE EXCEPTION 'Reserva de evidencia vencida o ya usada';
 END IF;
 IF EXISTS(SELECT 1 FROM public.procesos_firma WHERE sha256_documento_origen=p_sha256) THEN
  RAISE EXCEPTION 'La evidencia es un documento origen sin firmar';
 END IF;
 IF EXISTS(SELECT 1 FROM public.evidencias_firma WHERE sha256=p_sha256) THEN RAISE EXCEPTION 'El archivo ya se registró como evidencia'; END IF;
 v_object:=firma_privada.objeto_pdf(v_reserve.storage_path,p_size_bytes);
 IF v_object IS NULL THEN RAISE EXCEPTION 'El PDF no existe en Storage o su tamaño/tipo no coincide'; END IF;
 IF (v_object->>'created_at')::timestamptz<v_reserve.reservado_at THEN RAISE EXCEPTION 'El objeto de Storage es anterior a la reserva'; END IF;
 INSERT INTO public.evidencias_firma(id,proceso_firma_id,tipo,storage_path,sha256,mime_type,size_bytes,uploaded_by,
  declaracion_version,declaracion_texto,storage_object_id,storage_etag)
 VALUES(p_evidencia,p_proceso,'PDF_FIRMADO',v_reserve.storage_path,p_sha256,p_mime_type,p_size_bytes,p_actor,
  p_declaracion_version,firma_privada.declaracion_evidencia(p_declaracion_version,v_process.sha256_documento_origen),
  (v_object->>'id')::uuid,v_object->>'etag');
 UPDATE firma_privada.reservas_evidencia SET consumida_at=v_now WHERE id=p_evidencia;
 RETURN p_evidencia;
END $$;

-- 3. Completar: todas las firmas registradas, cobertura intacta y evidencia elegida explícitamente.
CREATE FUNCTION public.completar_proceso_firma(p_proceso uuid,p_evidencia uuid,p_sha256_evidencia text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_actor uuid:=firma_privada.admin_actual(); v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE;
 v_evidence public.evidencias_firma%ROWTYPE; v_cov record; v_count integer; v_object jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 PERFORM 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso)
  OR EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND estado<>'FIRMADO') THEN
  RAISE EXCEPTION 'Faltan firmas por registrar';
 END IF;
 -- Cobertura y plantilla congeladas al iniciar: se revalidan, nunca se modifican.
 IF firma_privada.cobertura(v_process.version_plantilla_id) IS DISTINCT FROM v_process.cobertura_snapshot THEN
  RAISE EXCEPTION 'La cobertura aprobada de la plantilla cambió desde el inicio del proceso';
 END IF;
 IF (SELECT firma_privada.sha256_texto(contenido) FROM public.versiones_plantilla WHERE id=v_process.version_plantilla_id) IS DISTINCT FROM v_process.sha256_plantilla THEN
  RAISE EXCEPTION 'La versión de plantilla cambió desde el inicio del proceso';
 END IF;
 FOR v_cov IN SELECT * FROM jsonb_to_recordset(v_process.cobertura_snapshot) AS x(rol text,minimo integer,maximo integer) LOOP
  SELECT count(*) INTO v_count FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND rol=v_cov.rol AND estado='FIRMADO';
  IF v_count<v_cov.minimo OR v_count>v_cov.maximo THEN RAISE EXCEPTION 'Firmas de % fuera de la cobertura aprobada',v_cov.rol; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p_proceso
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_process.cobertura_snapshot) c WHERE c->>'rol'=f.rol)) THEN
  RAISE EXCEPTION 'Firmante con rol no cubierto por la plantilla';
 END IF;
 SELECT * INTO v_evidence FROM public.evidencias_firma WHERE id=p_evidencia FOR SHARE;
 IF NOT FOUND OR v_evidence.proceso_firma_id IS DISTINCT FROM p_proceso THEN RAISE EXCEPTION 'Evidencia ajena al proceso o inexistente'; END IF;
 IF v_evidence.sha256 IS DISTINCT FROM p_sha256_evidencia THEN RAISE EXCEPTION 'El hash de la evidencia no coincide'; END IF;
 -- Una evidencia registrada antes del registro de la última firma no puede contenerlas todas.
 IF v_evidence.uploaded_at<(SELECT max(registrado_at) FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso) THEN
  RAISE EXCEPTION 'La evidencia es anterior al registro de la última firma';
 END IF;
 v_object:=firma_privada.objeto_pdf(v_evidence.storage_path,v_evidence.size_bytes);
 IF v_object IS NULL OR (v_object->>'id')::uuid IS DISTINCT FROM v_evidence.storage_object_id
  OR v_object->>'etag' IS DISTINCT FROM v_evidence.storage_etag THEN
  RAISE EXCEPTION 'El PDF firmado ya no está en Storage o fue sustituido';
 END IF;
 UPDATE public.procesos_firma SET estado='COMPLETADO',completado_at=v_now,completado_por=v_actor,
  evidencia_firmada_id=v_evidence.id,sha256_documento_firmado=v_evidence.sha256,updated_at=v_now WHERE id=p_proceso;
 UPDATE public.contratos SET estado='FIRMADO' WHERE id=v_cid;
 -- Documento origen intacto (PARA_FIRMA/GENERADO): es el PDF sin firmar; el firmado es la evidencia.
END $$;

-- 4. Anulación administrativa de un proceso con firmas o evidencias (cancelar_proceso_firma no lo admite).
-- Conserva firmas, evidencias, reservas y documento origen; bloquea nuevas firmas y evidencias (el proceso deja
-- de estar PENDIENTE) y lleva el contrato al destino elegido expresamente:
--   BORRADOR  -> se corrige y se reinicia con un proceso nuevo sobre una revisión nueva del documento;
--   CANCELADO -> la operación no seguirá; estado terminal.
CREATE FUNCTION public.anular_proceso_firma(p_proceso uuid,p_motivo text,p_destino_contrato text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_actor uuid:=firma_privada.admin_actual(); v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE;
 v_reason text:=btrim(p_motivo); v_now timestamptz:=clock_timestamp();
BEGIN
 IF v_reason IS NULL OR length(v_reason) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Motivo de anulación obligatorio (10 a 1000 caracteres)'; END IF;
 IF p_destino_contrato IS NULL OR p_destino_contrato NOT IN('BORRADOR','CANCELADO') THEN
  RAISE EXCEPTION 'Destino del contrato inválido: BORRADOR o CANCELADO';
 END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND estado='FIRMADO')
  AND NOT EXISTS(SELECT 1 FROM public.evidencias_firma WHERE proceso_firma_id=p_proceso) THEN
  RAISE EXCEPTION 'Proceso sin firmas ni evidencias: usa cancelar_proceso_firma';
 END IF;
 UPDATE public.procesos_firma SET estado='ANULADO',anulado_at=v_now,anulado_por=v_actor,motivo_anulacion=v_reason,
  destino_contrato_anulacion=p_destino_contrato,updated_at=v_now WHERE id=p_proceso;
 IF p_destino_contrato='BORRADOR' THEN
  UPDATE public.contratos SET estado='BORRADOR' WHERE id=v_cid;
 ELSE
  UPDATE public.contratos SET estado='CANCELADO' WHERE id=v_cid;
 END IF;
END $$;

-- 5. Huérfanos: reservas no consumidas, vencidas hace más de 1 h. Una reserva vencida ya no puede registrarse,
-- así que su objeto (si existe) nunca será evidencia y puede borrarse con seguridad. Solo service_role (tarea
-- de mantenimiento del servidor): listar -> borrar el objeto en Storage -> marcar.
CREATE FUNCTION public.listar_reservas_evidencia_vencidas(p_limite integer DEFAULT 100)
RETURNS TABLE(reserva_id uuid,ruta_storage text,vence_at timestamptz,objeto_presente boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.id,r.storage_path,r.expira_at,
  EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-documents' AND o.name=r.storage_path)
 FROM firma_privada.reservas_evidencia r
 WHERE r.consumida_at IS NULL AND r.expira_at<clock_timestamp()-interval '1 hour'
  AND NOT EXISTS(SELECT 1 FROM public.evidencias_firma e WHERE e.id=r.id)
  AND (r.limpiada_at IS NULL OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-documents' AND o.name=r.storage_path))
 ORDER BY r.expira_at,r.id
 LIMIT least(greatest(coalesce(p_limite,100),1),500)
$$;

CREATE FUNCTION public.marcar_reserva_evidencia_limpiada(p_reserva uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_pid uuid; v_cid uuid; v_reserve firma_privada.reservas_evidencia%ROWTYPE; v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT proceso_firma_id INTO v_pid FROM firma_privada.reservas_evidencia WHERE id=p_reserva;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reserva inexistente'; END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=v_pid;
 PERFORM 1 FROM public.contratos WHERE id=v_cid FOR UPDATE;
 PERFORM 1 FROM public.procesos_firma WHERE id=v_pid FOR UPDATE;
 SELECT * INTO v_reserve FROM firma_privada.reservas_evidencia WHERE id=p_reserva FOR UPDATE;
 IF v_reserve.consumida_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.evidencias_firma WHERE id=p_reserva) THEN
  RAISE EXCEPTION 'Reserva consumida: su objeto es evidencia y no se limpia';
 END IF;
 IF v_reserve.expira_at>=v_now-interval '1 hour' THEN RAISE EXCEPTION 'Reserva aún no vencida (margen de 1 hora)'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-documents' AND o.name=v_reserve.storage_path) THEN
  RAISE EXCEPTION 'El objeto sigue en Storage: bórralo antes de marcar la reserva';
 END IF;
 IF v_reserve.limpiada_at IS NULL THEN
  UPDATE firma_privada.reservas_evidencia SET limpiada_at=v_now WHERE id=p_reserva;
 END IF;
END $$;

-- ---------------------------------------------------------------- privilegios
-- Ninguna tabla gana privilegios: los clientes solo leen (RLS de la etapa 1) y las RPC escriben como propietario.
REVOKE ALL ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma TO authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.registrar_firma_firmante(uuid,uuid,text,text,timestamptz),
 public.reservar_evidencia_firma(uuid,uuid),
 public.registrar_evidencia_firma(uuid,uuid,uuid,text,bigint,text,text,boolean),
 public.completar_proceso_firma(uuid,uuid,text),
 public.anular_proceso_firma(uuid,text,text),
 public.listar_reservas_evidencia_vencidas(integer),
 public.marcar_reserva_evidencia_limpiada(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.registrar_firma_firmante(uuid,uuid,text,text,timestamptz),
 public.completar_proceso_firma(uuid,uuid,text),
 public.anular_proceso_firma(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_evidencia_firma(uuid,uuid),
 public.registrar_evidencia_firma(uuid,uuid,uuid,text,bigint,text,text,boolean),
 public.listar_reservas_evidencia_vencidas(integer),
 public.marcar_reserva_evidencia_limpiada(uuid) TO service_role;

-- Comprobación final del ACL efectivo de todo 2C (etapas 1 y 2), igual que en 02.
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
   OR (n.nspname='public' AND p.proname IN('firma_fuentes_para_verificar','registrar_validacion_documento_firma','reservar_evidencia_firma',
    'registrar_evidencia_firma','listar_reservas_evidencia_vencidas','marcar_reserva_evidencia_limpiada') AND a.grantee=v_service)
   OR (n.nspname='public' AND p.proname IN('iniciar_proceso_firma','cancelar_proceso_firma','registrar_firma_firmante','completar_proceso_firma',
    'anular_proceso_firma') AND a.grantee=v_auth)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE n.nspname='firma_privada' OR (n.nspname='public' AND p.proname IN('firma_fuentes_para_verificar',
   'registrar_validacion_documento_firma','iniciar_proceso_firma','cancelar_proceso_firma','registrar_firma_firmante',
   'reservar_evidencia_firma','registrar_evidencia_firma','completar_proceso_firma','anular_proceso_firma',
   'listar_reservas_evidencia_vencidas','marcar_reserva_evidencia_limpiada'))
  UNION ALL
  SELECT 'schema firma_privada',a.privilege_type,a.grantee,a.grantee=n.nspowner
  FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  WHERE n.nspname='firma_privada'
 ) x WHERE NOT x.ok;
 IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Privilegios inesperados tras instalar 2C etapa 2: %',v_bad; END IF;
END $postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
