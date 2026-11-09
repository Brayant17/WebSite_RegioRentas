-- 2C ETAPA 2 — FIRMA ELECTRÓNICA SIMPLE POR CORREO. PROPUESTA MANUAL PARA REVISIÓN.
-- NO ejecutar desde frontend/CI. NO aplicada en Supabase. Instalación única, no idempotente.
-- SUSTITUYE a 04_etapa2_firma_autografa.sql: instalar solo este archivo, nunca ambos (cada uno rechaza al otro).
-- Requiere 02_infraestructura_corregida.sql instalado y sin modificar (el preflight comprueba sus huellas).
--
-- Flujo (todo por RPC desde el servidor; el firmante no tiene sesión ni acceso directo a la base):
--  1. El administrador emite la invitación al correo congelado en el proceso. El servidor genera el token, guarda aquí
--     solo su SHA-256 y envía el enlace. Cambiar el correo es una acción aparte, con justificación y auditoría.
--  2. El firmante abre el enlace y el servidor le entrega el PDF exacto, calculando su SHA-256 sobre esos bytes.
--  3. Visualización -> consentimiento -> OTP -> firma dibujada, cada paso atado por FK al SHA-256 del documento origen.
--  4. Tras la última firma obligatoria, el servidor genera el PDF final con las firmas, lo sube y lo registra sin que
--     intervenga un administrador. Ese registro, en una sola transacción, completa el proceso y pasa el contrato a FIRMADO.
--  5. Con firmas parciales, el proceso no se cancela: se anula, conservando toda la evidencia.
--
-- Secretos: esta base nunca recibe el token ni el OTP en claro. El servidor envía SHA-256(token) y
-- HMAC-SHA256(secreto_servidor, invitacion_id || ':' || otp); el secreto solo existe en el servidor.
--
-- No se modifican: iniciar_proceso_firma, cancelar_proceso_firma, comprobar_transicion, proteger_evidencia,
-- la plantilla ni documentos_contrato. Del esquema storage solo se LEE storage.objects, para comprobar que el PDF final
-- existe: sin políticas, triggers, bloqueos ni escrituras. Solo se amplía, porque la etapa 1 las prohíbe
-- de forma expresa, la lista blanca de transiciones de proteger_proceso, proteger_firmante y proteger_contrato.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $preflight$
DECLARE v_fn text;
 -- md5 del cuerpo (prosrc) instalado por 02, normalizando CRLF -> LF.
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
 -- Ni esta migración ni la de firma autógrafa (04) instaladas, total o parcialmente.
 IF to_regclass('firma_privada.invitaciones_firma') IS NOT NULL OR to_regclass('firma_privada.reservas_evidencia') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   AND p.proname IN('emitir_invitacion_firma','cambiar_correo_firmante','revocar_invitacion_firma','abrir_invitacion_firma','registrar_visualizacion_firma',
    'registrar_consentimiento_firma','emitir_otp_firma','firmar_documento_electronico','consultar_evidencia_firma',
    'obtener_firma_dibujada','listar_procesos_por_finalizar','datos_pdf_final_firma','registrar_pdf_final_firma',
    'completar_proceso_firma','anular_proceso_firma','registrar_firma_firmante','reservar_evidencia_firma','registrar_evidencia_firma',
    'listar_reservas_evidencia_vencidas','marcar_reserva_evidencia_limpiada'))
  OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='procesos_firma'
   AND column_name IN('pdf_final_id','completado_por','anulado_at','anulado_por','motivo_anulacion','destino_contrato_anulacion','evidencia_firmada_id','sha256_documento_firmado')) THEN
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
 -- Los tres CHECK de procesos_firma con nombre generado se sustituyen; se localizan por definición.
 IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%CANCELADO%')<>2
  OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%CANCELADO%' AND pg_get_constraintdef(oid) LIKE '%motivo_cancelacion%')<>1
  OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%MANUAL%')<>1 THEN
  RAISE EXCEPTION 'Los CHECK de procesos_firma no son los de la etapa 1: requiere conciliación';
 END IF;
 -- La etapa 1 no puede haber producido firmas, evidencias ni procesos completados.
 IF EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE estado<>'PENDIENTE') OR EXISTS(SELECT 1 FROM public.evidencias_firma)
  OR EXISTS(SELECT 1 FROM public.procesos_firma WHERE estado='COMPLETADO') THEN
  RAISE EXCEPTION 'Existen firmas, evidencias o procesos completados previos: requieren conciliación';
 END IF;
 -- El PDF final se contrasta con el objeto real del bucket privado (solo lectura).
 IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN RAISE EXCEPTION 'Falta el esquema storage'; END IF;
 IF NOT has_table_privilege(current_user,'storage.objects','SELECT') OR NOT has_table_privilege(current_user,'storage.buckets','SELECT') THEN
  RAISE EXCEPTION 'El instalador no puede leer storage.objects/storage.buckets';
 END IF;
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects'
   AND ((column_name IN('bucket_id','name') AND data_type='text') OR (column_name='metadata' AND data_type='jsonb') OR (column_name='id' AND data_type='uuid')))<>4 THEN
  RAISE EXCEPTION 'storage.objects sin id/bucket_id/name/metadata con los tipos esperados';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='contract-documents' AND public IS FALSE) THEN
  RAISE EXCEPTION 'El bucket contract-documents no existe o no es privado';
 END IF;
END $preflight$;

-- ---------------------------------------------------------------- columnas y restricciones
ALTER TABLE public.procesos_firma
 ADD COLUMN pdf_final_id uuid,
 ADD COLUMN sha256_documento_firmado text CHECK(sha256_documento_firmado ~ '^[0-9a-f]{64}$'),
 ADD COLUMN pdf_final_at timestamptz,
 ADD COLUMN anulado_at timestamptz,
 ADD COLUMN anulado_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 ADD COLUMN motivo_anulacion text,
 ADD COLUMN destino_contrato_anulacion text;

DO $checks$
DECLARE v_name text;
BEGIN
 FOR v_name IN SELECT conname FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c'
  AND (pg_get_constraintdef(oid) LIKE '%CANCELADO%' OR pg_get_constraintdef(oid) LIKE '%MANUAL%') LOOP
  EXECUTE format('ALTER TABLE public.procesos_firma DROP CONSTRAINT %I',v_name);
 END LOOP;
END $checks$;

-- Mismas reglas de la etapa 1 para PENDIENTE/COMPLETADO/CANCELADO, más ANULADO. Solo un proceso electrónico se completa,
-- y nunca sin su PDF final registrado.
ALTER TABLE public.procesos_firma
 ADD CONSTRAINT procesos_firma_esf_metodo CHECK(metodo IN('MANUAL','ELECTRONICA_SIMPLE')),
 ADD CONSTRAINT procesos_firma_esf_estado CHECK(estado IN('PENDIENTE','COMPLETADO','CANCELADO','ANULADO')),
 ADD CONSTRAINT procesos_firma_esf_cierre CHECK(
  (completado_at IS NOT NULL)=(estado='COMPLETADO')
  AND (pdf_final_id IS NOT NULL)=(estado='COMPLETADO') AND (sha256_documento_firmado IS NOT NULL)=(estado='COMPLETADO') AND (pdf_final_at IS NOT NULL)=(estado='COMPLETADO')
  AND (estado<>'COMPLETADO' OR metodo='ELECTRONICA_SIMPLE')
  AND (cancelado_at IS NOT NULL)=(estado='CANCELADO') AND (cancelado_por IS NOT NULL)=(estado='CANCELADO')
  AND (motivo_cancelacion IS NOT NULL)=(estado='CANCELADO') AND (estado<>'CANCELADO' OR nullif(btrim(motivo_cancelacion),'') IS NOT NULL)
  AND (anulado_at IS NOT NULL)=(estado='ANULADO') AND (anulado_por IS NOT NULL)=(estado='ANULADO')
  AND (motivo_anulacion IS NOT NULL)=(estado='ANULADO') AND (destino_contrato_anulacion IS NOT NULL)=(estado='ANULADO')
  AND (estado<>'ANULADO' OR (motivo_anulacion=btrim(motivo_anulacion) AND length(motivo_anulacion) BETWEEN 10 AND 1000
   AND destino_contrato_anulacion IN('BORRADOR','CANCELADO')))),
 ADD CONSTRAINT procesos_firma_esf_id_sha_un UNIQUE(id,sha256_documento_origen);
-- iniciar_proceso_firma no indica el método: los procesos nuevos toman este valor. Los previos conservan MANUAL.
ALTER TABLE public.procesos_firma ALTER COLUMN metodo SET DEFAULT 'ELECTRONICA_SIMPLE';
ALTER TABLE public.firmantes_proceso ADD CONSTRAINT firmantes_proceso_esf_id_proceso_un UNIQUE(id,proceso_firma_id);
CREATE UNIQUE INDEX procesos_firma_un_completado ON public.procesos_firma(contrato_id) WHERE estado='COMPLETADO';
CREATE INDEX procesos_firma_sha_origen_idx ON public.procesos_firma(sha256_documento_origen);
CREATE INDEX procesos_firma_anulado_por_idx ON public.procesos_firma(anulado_por);
COMMENT ON COLUMN public.firmantes_proceso.registrado_por IS 'En firma electrónica: administrador que emitió la invitación usada. El firmante y su evidencia están en firma_privada.firmas_electronicas';
COMMENT ON COLUMN public.firmantes_proceso.firmado_at IS 'En firma electrónica: reloj del servidor al verificar el OTP';

-- ---------------------------------------------------------------- tablas privadas (sin acceso de clientes)
-- Cambios de correo: acción expresa de un administrador, solo de altas. El correo vigente es el último cambio o,
-- si no hay ninguno, el congelado en firmantes_proceso.snapshot, que nunca se modifica.
CREATE TABLE firma_privada.cambios_correo_firmante (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL,
 firmante_id uuid NOT NULL,
 correo_anterior text,
 correo_nuevo text NOT NULL CHECK(correo_nuevo=lower(btrim(correo_nuevo)) AND length(correo_nuevo)<=320 AND correo_nuevo ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
 justificacion text NOT NULL CHECK(justificacion=btrim(justificacion) AND length(justificacion) BETWEEN 10 AND 1000),
 cambiado_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 cambiado_at timestamptz NOT NULL,
 FOREIGN KEY(firmante_id,proceso_firma_id) REFERENCES public.firmantes_proceso(id,proceso_firma_id) ON DELETE RESTRICT,
 CHECK(correo_anterior IS DISTINCT FROM correo_nuevo)
);
CREATE INDEX cambios_correo_firmante_vigente_idx ON firma_privada.cambios_correo_firmante(firmante_id,cambiado_at DESC,id DESC);
CREATE INDEX cambios_correo_firmante_proceso_idx ON firma_privada.cambios_correo_firmante(proceso_firma_id,cambiado_at);
CREATE INDEX cambios_correo_firmante_por_idx ON firma_privada.cambios_correo_firmante(cambiado_por);

-- token_hash: SHA-256 de un token aleatorio de 256 bits generado por el servidor. Uso único: usada_at al firmar.
CREATE TABLE firma_privada.invitaciones_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL,
 firmante_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 correo text NOT NULL CHECK(correo=lower(btrim(correo)) AND length(correo)<=320 AND correo ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
 emitida_por uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 emitida_at timestamptz NOT NULL,
 expira_at timestamptz NOT NULL,
 usada_at timestamptz,
 revocada_at timestamptz,
 revocada_por uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 motivo_revocacion text CHECK(motivo_revocacion IS NULL OR length(motivo_revocacion) BETWEEN 1 AND 1000),
 FOREIGN KEY(firmante_id,proceso_firma_id) REFERENCES public.firmantes_proceso(id,proceso_firma_id) ON DELETE RESTRICT,
 UNIQUE(id,proceso_firma_id,firmante_id),
 CHECK(expira_at>emitida_at AND expira_at<=emitida_at+interval '7 days'),
 CHECK(usada_at IS NULL OR revocada_at IS NULL),
 CHECK((revocada_at IS NULL)=(revocada_por IS NULL) AND (revocada_at IS NULL)=(motivo_revocacion IS NULL))
);
-- Como máximo una invitación viva y una usada por firmante.
CREATE UNIQUE INDEX invitaciones_firma_una_viva ON firma_privada.invitaciones_firma(firmante_id) WHERE usada_at IS NULL AND revocada_at IS NULL;
CREATE UNIQUE INDEX invitaciones_firma_una_usada ON firma_privada.invitaciones_firma(firmante_id) WHERE usada_at IS NOT NULL;
CREATE INDEX invitaciones_firma_proceso_idx ON firma_privada.invitaciones_firma(proceso_firma_id);
CREATE INDEX invitaciones_firma_emitida_por_idx ON firma_privada.invitaciones_firma(emitida_por);
CREATE INDEX invitaciones_firma_revocada_por_idx ON firma_privada.invitaciones_firma(revocada_por);

-- Bitácora solo de altas: cada paso del firmante y del administrador, con IP y navegador.
CREATE TABLE firma_privada.eventos_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invitacion_id uuid NOT NULL,
 proceso_firma_id uuid NOT NULL,
 firmante_id uuid NOT NULL,
 tipo text NOT NULL CHECK(tipo IN('INVITACION_EMITIDA','INVITACION_REVOCADA','INVITACION_ABIERTA','DOCUMENTO_VISUALIZADO','CONSENTIMIENTO_OTORGADO',
  'OTP_EMITIDO','OTP_FALLIDO','OTP_AGOTADO','OTP_VENCIDO','FIRMA_REGISTRADA','PROCESO_COMPLETADO')),
 sha256_documento text CHECK(sha256_documento ~ '^[0-9a-f]{64}$'),
 actor_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 ip inet,
 user_agent text CHECK(length(user_agent)<=512),
 detalle jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(detalle)='object'),
 ocurrido_at timestamptz NOT NULL,
 FOREIGN KEY(invitacion_id,proceso_firma_id,firmante_id) REFERENCES firma_privada.invitaciones_firma(id,proceso_firma_id,firmante_id) ON DELETE RESTRICT,
 FOREIGN KEY(proceso_firma_id,sha256_documento) REFERENCES public.procesos_firma(id,sha256_documento_origen) ON DELETE RESTRICT,
 UNIQUE(id,invitacion_id,sha256_documento),
 CHECK(tipo<>'DOCUMENTO_VISUALIZADO' OR sha256_documento IS NOT NULL)
);
CREATE INDEX eventos_firma_invitacion_idx ON firma_privada.eventos_firma(invitacion_id,tipo,ocurrido_at);
CREATE INDEX eventos_firma_proceso_idx ON firma_privada.eventos_firma(proceso_firma_id,ocurrido_at);
CREATE INDEX eventos_firma_firmante_idx ON firma_privada.eventos_firma(firmante_id);
CREATE INDEX eventos_firma_actor_idx ON firma_privada.eventos_firma(actor_id);

-- Consentimiento: texto exacto aceptado, atado por FK a una visualización de ese mismo hash en esa misma invitación,
-- y al hash del documento origen del proceso.
CREATE TABLE firma_privada.consentimientos_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invitacion_id uuid NOT NULL UNIQUE,
 proceso_firma_id uuid NOT NULL,
 firmante_id uuid NOT NULL,
 visualizacion_id uuid NOT NULL,
 sha256_documento text NOT NULL CHECK(sha256_documento ~ '^[0-9a-f]{64}$'),
 version text NOT NULL CHECK(version='CONSENTIMIENTO_FES_V2'),
 texto text NOT NULL CHECK(position(sha256_documento IN texto)>0),
 ip inet,
 user_agent text CHECK(length(user_agent)<=512),
 otorgado_at timestamptz NOT NULL,
 FOREIGN KEY(invitacion_id,proceso_firma_id,firmante_id) REFERENCES firma_privada.invitaciones_firma(id,proceso_firma_id,firmante_id) ON DELETE RESTRICT,
 FOREIGN KEY(proceso_firma_id,sha256_documento) REFERENCES public.procesos_firma(id,sha256_documento_origen) ON DELETE RESTRICT,
 FOREIGN KEY(visualizacion_id,invitacion_id,sha256_documento) REFERENCES firma_privada.eventos_firma(id,invitacion_id,sha256_documento) ON DELETE RESTRICT,
 UNIQUE(id,invitacion_id,proceso_firma_id,firmante_id,sha256_documento)
);
CREATE INDEX consentimientos_firma_proceso_idx ON firma_privada.consentimientos_firma(proceso_firma_id,sha256_documento);
CREATE INDEX consentimientos_firma_firmante_idx ON firma_privada.consentimientos_firma(firmante_id);
CREATE INDEX consentimientos_firma_visualizacion_idx ON firma_privada.consentimientos_firma(visualizacion_id);

-- OTP: otp_hmac = HMAC-SHA256(secreto_servidor, invitacion_id || ':' || otp). Máximo 5 intentos por código.
CREATE TABLE firma_privada.otps_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invitacion_id uuid NOT NULL REFERENCES firma_privada.invitaciones_firma(id) ON DELETE RESTRICT,
 otp_hmac text NOT NULL CHECK(otp_hmac ~ '^[0-9a-f]{64}$'),
 emitido_at timestamptz NOT NULL,
 expira_at timestamptz NOT NULL,
 intentos integer NOT NULL DEFAULT 0 CHECK(intentos BETWEEN 0 AND 5),
 invalidado_at timestamptz,
 motivo_invalidacion text CHECK(motivo_invalidacion IN('REENVIO','AGOTADO','VENCIDO')),
 consumido_at timestamptz,
 UNIQUE(id,invitacion_id),
 CHECK(expira_at>emitido_at AND expira_at<=emitido_at+interval '15 minutes'),
 CHECK((invalidado_at IS NULL)=(motivo_invalidacion IS NULL)),
 CHECK(invalidado_at IS NULL OR consumido_at IS NULL)
);
CREATE UNIQUE INDEX otps_firma_uno_vivo ON firma_privada.otps_firma(invitacion_id) WHERE invalidado_at IS NULL AND consumido_at IS NULL;
CREATE INDEX otps_firma_invitacion_idx ON firma_privada.otps_firma(invitacion_id,emitido_at DESC);

-- Evidencia de la firma: las FK compuestas impiden vincular otro consentimiento, otro OTP u otro hash.
-- firma_png: imagen que el firmante dibujó y confirmó. Va en la base y no en Storage: es privada, inmutable y se guarda
-- en la misma transacción que la firma. PostgreSQL calcula su hash; sha256_evidencia encadena imagen, invitación,
-- consentimiento, OTP, persona y documento origen.
CREATE TABLE firma_privada.firmas_electronicas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL,
 firmante_id uuid NOT NULL UNIQUE,
 invitacion_id uuid NOT NULL UNIQUE,
 consentimiento_id uuid NOT NULL UNIQUE,
 otp_id uuid NOT NULL UNIQUE,
 sha256_documento text NOT NULL CHECK(sha256_documento ~ '^[0-9a-f]{64}$'),
 persona_firmante_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE RESTRICT,
 nombre_firmante text NOT NULL CHECK(btrim(nombre_firmante)<>''),
 correo text NOT NULL,
 firma_png bytea NOT NULL CHECK(octet_length(firma_png) BETWEEN 67 AND 262144 AND substring(firma_png FROM 1 FOR 8)='\x89504e470d0a1a0a'::bytea),
 sha256_firma text NOT NULL,
 sha256_evidencia text NOT NULL UNIQUE CHECK(sha256_evidencia ~ '^[0-9a-f]{64}$'),
 ip inet,
 user_agent text CHECK(length(user_agent)<=512),
 firmado_at timestamptz NOT NULL,
 FOREIGN KEY(firmante_id,proceso_firma_id) REFERENCES public.firmantes_proceso(id,proceso_firma_id) ON DELETE RESTRICT,
 FOREIGN KEY(proceso_firma_id,sha256_documento) REFERENCES public.procesos_firma(id,sha256_documento_origen) ON DELETE RESTRICT,
 FOREIGN KEY(consentimiento_id,invitacion_id,proceso_firma_id,firmante_id,sha256_documento)
  REFERENCES firma_privada.consentimientos_firma(id,invitacion_id,proceso_firma_id,firmante_id,sha256_documento) ON DELETE RESTRICT,
 FOREIGN KEY(otp_id,invitacion_id) REFERENCES firma_privada.otps_firma(id,invitacion_id) ON DELETE RESTRICT,
 CHECK(sha256_firma=encode(sha256(firma_png),'hex'))
);
CREATE INDEX firmas_electronicas_proceso_idx ON firma_privada.firmas_electronicas(proceso_firma_id,sha256_documento);
CREATE INDEX firmas_electronicas_persona_idx ON firma_privada.firmas_electronicas(persona_firmante_id);

-- PDF final: uno por proceso, en una ruta canónica, inmutable. manifiesto fija qué firmas incorpora.
-- PostgreSQL no puede leer el PDF: el servidor calcula su SHA-256 sobre los bytes que sube e incluye sha256_manifiesto en él.
CREATE TABLE firma_privada.pdfs_finales_firma (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proceso_firma_id uuid NOT NULL UNIQUE,
 contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
 sha256_documento_origen text NOT NULL,
 sha256 text NOT NULL UNIQUE CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
 mime_type text NOT NULL CHECK(mime_type='application/pdf'),
 storage_path text NOT NULL UNIQUE CHECK(storage_path=contrato_id::text||'/firmas/'||proceso_firma_id::text||'/firmado.pdf'),
 storage_object_id uuid NOT NULL,
 storage_etag text,
 manifiesto jsonb NOT NULL CHECK(jsonb_typeof(manifiesto)='array' AND jsonb_array_length(manifiesto)>0),
 sha256_manifiesto text NOT NULL CHECK(sha256_manifiesto ~ '^[0-9a-f]{64}$'),
 generador text NOT NULL CHECK(btrim(generador)<>'' AND length(generador)<=200),
 registrado_at timestamptz NOT NULL,
 FOREIGN KEY(proceso_firma_id,sha256_documento_origen) REFERENCES public.procesos_firma(id,sha256_documento_origen) ON DELETE RESTRICT,
 UNIQUE(id,proceso_firma_id,sha256),
 CHECK(sha256<>sha256_documento_origen)
);
CREATE INDEX pdfs_finales_firma_contrato_idx ON firma_privada.pdfs_finales_firma(contrato_id);
ALTER TABLE public.procesos_firma ADD CONSTRAINT procesos_firma_esf_pdf_final_fk FOREIGN KEY(pdf_final_id,id,sha256_documento_firmado)
 REFERENCES firma_privada.pdfs_finales_firma(id,proceso_firma_id,sha256) ON DELETE RESTRICT;
CREATE INDEX procesos_firma_pdf_final_idx ON public.procesos_firma(pdf_final_id);

ALTER TABLE firma_privada.cambios_correo_firmante ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_privada.invitaciones_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_privada.eventos_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_privada.consentimientos_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_privada.otps_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_privada.firmas_electronicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE firma_privada.pdfs_finales_firma ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- auxiliares privadas
CREATE FUNCTION firma_privada.exigir_admin(p_actor uuid) RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND role='admin') THEN
  RAISE EXCEPTION 'Administrador inválido' USING ERRCODE='42501';
 END IF;
END $$;

-- Texto exacto que acepta el firmante; se guarda literal en el consentimiento.
-- Consentimiento V1: revisado, nunca vigente ni otorgado. Se conserva sin cambios para identificar el texto que V2 reemplaza.
CREATE FUNCTION firma_privada.texto_consentimiento(p_version text,p_nombre text,p_caracter text,p_rol text,p_folio text,p_sha256 text,p_correo text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_version='CONSENTIMIENTO_FES_V1' THEN
  'Yo, '||p_nombre||', con el carácter de '||p_caracter||' y como '||p_rol||', declaro que revisé el documento PDF del contrato '||p_folio
  ||', identificado con la huella SHA-256 '||p_sha256||'; que acepto firmarlo por medios electrónicos; y que el código de un solo uso enviado a '
  ||p_correo||', junto con este registro, constituye mi firma electrónica sobre exactamente ese documento.'
 END
$$;

-- Consentimiento V2, el vigente: se acepta antes de dibujar y antes de recibir el código, por eso habla en futuro. La aceptación
-- del contenido solo surte efecto al completar la firma. Lo mostrado es lo guardado: no hay otro texto ni formato en la interfaz.
-- Cambiarlo tras instalar exige una versión nueva, porque cada consentimiento guarda el texto exacto y su hash entra en la evidencia.
CREATE FUNCTION firma_privada.texto_consentimiento_v2(p_nombre text,p_calidad text,p_folio text,p_sha256 text,p_correo_enmascarado text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT 'Yo, '||p_nombre||', '||p_calidad||', manifiesto lo siguiente respecto del contrato '||p_folio||', identificado con la huella digital SHA-256 '||p_sha256||':'
  ||E'\n\n1. Firma electrónica. Acepto firmar este contrato por medios electrónicos.'
  ||E'\n\n2. Firma dibujada. Dibujaré mi firma en pantalla y la confirmaré antes de enviarla. Esa imagen quedará vinculada a este documento y se incorporará a su versión final.'
  ||E'\n\n3. Verificación por correo. Mi firma solo se completará si ingreso el código de un solo uso que se enviará a '||p_correo_enmascarado||', el correo registrado para mí en este proceso.'
  ||E'\n\n4. Conservación. Autorizo que se conserven el documento, mi firma dibujada y las evidencias electrónicas de este proceso, que incluyen fechas y horas, dirección IP, datos del navegador, el correo utilizado y las huellas digitales de la firma y de la evidencia.'
  ||E'\n\n5. Contenido del contrato. Declaro que revisé el documento mostrado. Al completar la firma, acepto expresamente su contenido.'
$$;

-- El tipo de entidad y el rol son valores cerrados y se traducen. El carácter nunca decide si alguien actúa por derecho propio.
-- Los códigos del catálogo de la aplicación tienen redacción propia; OTRO no afirma ningún carácter, porque no hay facultades
-- específicas registradas. Fuera del catálogo, el texto libre se muestra sin cambios y otro valor con forma de código se omite,
-- porque no hay una lectura segura. El valor original sigue íntegro en firmantes_proceso.
CREATE FUNCTION firma_privada.calidad_firmante(p_entidad_tipo text,p_caracter text,p_nombre_entidad text,p_rol text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
   WHEN p_entidad_tipo='PERSONA' THEN 'por mi propio derecho'
   WHEN p_caracter='REPRESENTANTE_LEGAL' THEN 'en mi carácter de representante legal de '||p_nombre_entidad
   WHEN p_caracter='APODERADO_LEGAL' THEN 'en mi carácter de apoderado legal de '||p_nombre_entidad
   WHEN p_caracter='ADMINISTRADOR' THEN 'en mi carácter de administrador de '||p_nombre_entidad
   WHEN p_caracter='OTRO' THEN 'en representación de '||p_nombre_entidad
   WHEN p_caracter ~* '^[a-z0-9]+(_[a-z0-9]+)+$' THEN 'en representación de '||p_nombre_entidad
   ELSE 'en representación de '||p_nombre_entidad||', con el carácter registrado de «'||p_caracter||'»'
  END
  ||', como '||CASE p_rol WHEN 'ARRENDADOR' THEN 'parte arrendadora' WHEN 'ARRENDATARIO' THEN 'parte arrendataria' WHEN 'FIADOR' THEN 'parte fiadora'
   WHEN 'OBLIGADO_SOLIDARIO' THEN 'parte obligada solidaria' WHEN 'REPRESENTANTE_LEGAL' THEN 'representante legal' END
$$;

-- Lo único que ve quien tenga el enlace. El correo completo queda en invitaciones_firma, firmas_electronicas y la huella de evidencia.
CREATE FUNCTION firma_privada.correo_enmascarado(p_correo text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT left(x.usuario,CASE WHEN length(x.usuario)<=2 THEN 1 ELSE 2 END)||'***@'||split_part(p_correo,'@',2) FROM (SELECT split_part(p_correo,'@',1) AS usuario) x
$$;

CREATE FUNCTION firma_privada.nombre_firmante(p_snapshot jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT firma_privada.nombre_completo(p_snapshot#>>'{persona_firmante,nombre}',p_snapshot#>>'{persona_firmante,apellido_paterno}',p_snapshot#>>'{persona_firmante,apellido_materno}')
$$;

CREATE FUNCTION firma_privada.consentimiento_invitacion(p_inv firma_privada.invitaciones_firma) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT firma_privada.texto_consentimiento_v2(firma_privada.nombre_firmante(f.snapshot),firma_privada.calidad_firmante(f.entidad_tipo,f.caracter,f.nombre_entidad,f.rol),c.folio,p.sha256_documento_origen,firma_privada.correo_enmascarado(p_inv.correo))
 FROM public.firmantes_proceso f JOIN public.procesos_firma p ON p.id=f.proceso_firma_id JOIN public.contratos c ON c.id=p.contrato_id
 WHERE f.id=p_inv.firmante_id
$$;

-- Fecha en texto independiente de la zona horaria de la sesión: forma parte de lo que se hashea.
CREATE FUNCTION firma_privada.utc_texto(p_momento timestamptz) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT to_char(p_momento AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

-- Decodifica y valida la firma dibujada. p_sha256 es el hash que calculó el servidor: detecta una alteración en tránsito.
CREATE FUNCTION firma_privada.decodificar_firma(p_base64 text,p_sha256 text) RETURNS bytea LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_png bytea;
BEGIN
 BEGIN
  v_png:=decode(p_base64,'base64');
 EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'La firma dibujada no es válida' USING ERRCODE='RF008';
 END;
 IF v_png IS NULL OR octet_length(v_png) NOT BETWEEN 67 AND 262144 OR substring(v_png FROM 1 FOR 8)<>'\x89504e470d0a1a0a'::bytea THEN
  RAISE EXCEPTION 'La firma dibujada no es válida: se requiere un PNG de hasta 256 KiB' USING ERRCODE='RF008';
 END IF;
 IF p_sha256 IS DISTINCT FROM encode(sha256(v_png),'hex') THEN RAISE EXCEPTION 'El hash de la firma dibujada no coincide' USING ERRCODE='RF008'; END IF;
 RETURN v_png;
END $$;

-- Vínculo criptográfico de la firma con su evidencia: cambiar cualquiera de estos datos cambia la huella.
CREATE FUNCTION firma_privada.huella_firma(p_firma uuid,p_proceso uuid,p_firmante uuid,p_invitacion uuid,p_consentimiento uuid,p_otp uuid,p_persona uuid,
 p_correo text,p_sha256_documento text,p_sha256_firma text,p_firmado_at timestamptz) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT firma_privada.sha256_texto(concat_ws('|','EVIDENCIA_FES_V1',p_firma,p_proceso,p_firmante,p_invitacion,p_consentimiento,
  (SELECT firma_privada.sha256_texto(c.texto) FROM firma_privada.consentimientos_firma c WHERE c.id=p_consentimiento),
  p_otp,p_persona,p_correo,p_sha256_documento,p_sha256_firma,firma_privada.utc_texto(p_firmado_at)))
$$;

-- Firmas que debe incorporar el PDF final, en orden estable.
CREATE FUNCTION firma_privada.manifiesto_firmas(p_proceso uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('firma_id',e.id,'firmante_id',e.firmante_id,'rol',f.rol,'caracter',f.caracter,'nombre_entidad',f.nombre_entidad,
   'persona_firmante_id',e.persona_firmante_id,'nombre_firmante',e.nombre_firmante,'firmado_at',firma_privada.utc_texto(e.firmado_at),
   'sha256_documento',e.sha256_documento,'sha256_firma',e.sha256_firma,'sha256_evidencia',e.sha256_evidencia) ORDER BY e.firmante_id),'[]'::jsonb)
 FROM firma_privada.firmas_electronicas e JOIN public.firmantes_proceso f ON f.id=e.firmante_id WHERE e.proceso_firma_id=p_proceso
$$;

-- Objeto del bucket privado con el tamaño y tipo declarados; NULL si no existe o no coincide. Solo lectura, sin bloqueo.
CREATE FUNCTION firma_privada.objeto_pdf(p_path text,p_bytes bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',o.id,'etag',o.metadata->>'eTag') FROM storage.objects o
 WHERE o.bucket_id='contract-documents' AND o.name=p_path AND o.metadata->>'mimetype'='application/pdf' AND o.metadata->>'size'=p_bytes::text
$$;

-- ¿Firmaron todos los obligatorios?
CREATE FUNCTION firma_privada.todas_firmadas(p_proceso uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND requerido)
  AND NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND requerido AND estado<>'FIRMADO')
$$;

-- Comprobaciones del cierre, con todas las firmas ya registradas: evidencia de cada una, cobertura y plantilla congeladas.
CREATE FUNCTION firma_privada.validar_cierre(p_process public.procesos_firma) RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE v_cov record; v_count integer;
BEGIN
 IF EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p_process.id AND f.requerido
   AND NOT EXISTS(SELECT 1 FROM firma_privada.firmas_electronicas e WHERE e.firmante_id=f.id AND e.sha256_documento=p_process.sha256_documento_origen)) THEN
  RAISE EXCEPTION 'Hay firmas obligatorias sin evidencia: no se puede completar' USING ERRCODE='RF006';
 END IF;
 IF firma_privada.cobertura(p_process.version_plantilla_id) IS DISTINCT FROM p_process.cobertura_snapshot THEN
  RAISE EXCEPTION 'La cobertura aprobada de la plantilla cambió desde el inicio del proceso' USING ERRCODE='RF006';
 END IF;
 IF (SELECT firma_privada.sha256_texto(contenido) FROM public.versiones_plantilla WHERE id=p_process.version_plantilla_id) IS DISTINCT FROM p_process.sha256_plantilla THEN
  RAISE EXCEPTION 'La versión de plantilla cambió desde el inicio del proceso' USING ERRCODE='RF006';
 END IF;
 FOR v_cov IN SELECT * FROM jsonb_to_recordset(p_process.cobertura_snapshot) AS x(rol text,minimo integer,maximo integer) LOOP
  SELECT count(*) INTO v_count FROM public.firmantes_proceso WHERE proceso_firma_id=p_process.id AND rol=v_cov.rol AND estado='FIRMADO';
  IF v_count<v_cov.minimo OR v_count>v_cov.maximo THEN RAISE EXCEPTION 'Firmas de % fuera de la cobertura aprobada',v_cov.rol USING ERRCODE='RF006'; END IF;
 END LOOP;
END $$;

-- Correo al que se puede invitar: el último cambio registrado o, si no hay, el congelado al iniciar el proceso.
CREATE FUNCTION firma_privada.correo_vigente(p_firmante uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(
  (SELECT c.correo_nuevo FROM firma_privada.cambios_correo_firmante c WHERE c.firmante_id=p_firmante ORDER BY c.cambiado_at DESC,c.id DESC LIMIT 1),
  (SELECT nullif(lower(btrim(f.snapshot#>>'{persona_firmante,correo}')),'') FROM public.firmantes_proceso f WHERE f.id=p_firmante))
$$;

-- Toma los bloqueos en el orden común y devuelve la invitación vigente. Cualquier causa de rechazo produce el
-- mismo error, sin revelar si el token existe, venció o ya se usó. El servidor responde igual ante todas.
CREATE FUNCTION firma_privada.invitacion_bloqueada(p_token_hash text) RETURNS firma_privada.invitaciones_firma
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_inv firma_privada.invitaciones_firma%ROWTYPE; v_pid uuid; v_fid uuid; v_cid uuid; v_state text;
 v_process public.procesos_firma%ROWTYPE; v_signer public.firmantes_proceso%ROWTYPE;
BEGIN
 SELECT i.proceso_firma_id,i.firmante_id,p.contrato_id INTO v_pid,v_fid,v_cid FROM firma_privada.invitaciones_firma i
  JOIN public.procesos_firma p ON p.id=i.proceso_firma_id WHERE i.token_hash=p_token_hash;
 IF FOUND THEN
  SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
  SELECT * INTO v_process FROM public.procesos_firma WHERE id=v_pid FOR UPDATE;
  SELECT * INTO v_signer FROM public.firmantes_proceso WHERE id=v_fid FOR UPDATE;
  SELECT * INTO v_inv FROM firma_privada.invitaciones_firma WHERE token_hash=p_token_hash FOR UPDATE;
  IF v_state='PENDIENTE_FIRMA' AND v_process.estado='PENDIENTE' AND v_process.metodo='ELECTRONICA_SIMPLE' AND v_signer.estado='PENDIENTE'
   AND v_inv.usada_at IS NULL AND v_inv.revocada_at IS NULL AND v_inv.expira_at>clock_timestamp() THEN
   RETURN v_inv;
  END IF;
 END IF;
 RAISE EXCEPTION 'Invitación inválida, vencida, revocada o ya utilizada' USING ERRCODE='RF001';
END $$;

CREATE FUNCTION firma_privada.registrar_evento(p_inv firma_privada.invitaciones_firma,p_tipo text,p_sha256 text,p_actor uuid,p_ip inet,p_user_agent text,p_detalle jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO firma_privada.eventos_firma(invitacion_id,proceso_firma_id,firmante_id,tipo,sha256_documento,actor_id,ip,user_agent,detalle,ocurrido_at)
 VALUES(p_inv.id,p_inv.proceso_firma_id,p_inv.firmante_id,p_tipo,p_sha256,p_actor,p_ip,left(p_user_agent,512),p_detalle,clock_timestamp()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

-- ---------------------------------------------------------------- triggers de tablas privadas
CREATE FUNCTION firma_privada.proteger_invitacion() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_mutable text[]:=ARRAY['usada_at','revocada_at','revocada_por','motivo_revocacion'];
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Invitaciones de firma: escritura solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP IN('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'No se elimina auditoría de firma'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.usada_at IS NOT NULL OR NEW.revocada_at IS NOT NULL OR NEW.correo IS DISTINCT FROM firma_privada.correo_vigente(NEW.firmante_id)
   OR NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE id=NEW.proceso_firma_id AND estado='PENDIENTE' AND metodo='ELECTRONICA_SIMPLE')
   OR NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE id=NEW.firmante_id AND estado='PENDIENTE') THEN
   RAISE EXCEPTION 'Invitación inconsistente';
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.usada_at IS NOT NULL OR OLD.revocada_at IS NOT NULL OR (to_jsonb(OLD)-v_mutable) IS DISTINCT FROM (to_jsonb(NEW)-v_mutable) THEN
  RAISE EXCEPTION 'Invitación: solo se marca una vez como usada o revocada';
 END IF;
 IF NEW.usada_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM firma_privada.firmas_electronicas WHERE invitacion_id=NEW.id) THEN
  RAISE EXCEPTION 'Invitación usada sin firma';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_invitacion BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.invitaciones_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_invitacion();
CREATE TRIGGER firma_2c_invitacion_truncate BEFORE TRUNCATE ON firma_privada.invitaciones_firma FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_invitacion();

CREATE FUNCTION firma_privada.proteger_otp() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_mutable text[]:=ARRAY['intentos','invalidado_at','motivo_invalidacion','consumido_at'];
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'OTP de firma: escritura solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP IN('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'No se elimina auditoría de firma'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.intentos<>0 OR NEW.invalidado_at IS NOT NULL OR NEW.consumido_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM firma_privada.consentimientos_firma WHERE invitacion_id=NEW.invitacion_id) THEN
   RAISE EXCEPTION 'OTP inconsistente: requiere consentimiento previo';
  END IF;
  RETURN NEW;
 END IF;
 -- Un código cerrado no cambia y los intentos nunca bajan: reenviar crea otra fila, no reinicia el contador.
 IF OLD.invalidado_at IS NOT NULL OR OLD.consumido_at IS NOT NULL OR NEW.intentos<OLD.intentos
  OR (to_jsonb(OLD)-v_mutable) IS DISTINCT FROM (to_jsonb(NEW)-v_mutable) THEN
  RAISE EXCEPTION 'OTP cerrado o cambio no permitido';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_otp BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.otps_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_otp();
CREATE TRIGGER firma_2c_otp_truncate BEFORE TRUNCATE ON firma_privada.otps_firma FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_otp();

-- Evidencia solo de altas: cambios de correo, bitácora, consentimientos, firmas y PDF final.
CREATE FUNCTION firma_privada.proteger_apendice() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Evidencia de firma: alta solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Evidencia de firma inmutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_cambio_correo BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.cambios_correo_firmante FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_cambio_correo_truncate BEFORE TRUNCATE ON firma_privada.cambios_correo_firmante FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_evento BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.eventos_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_evento_truncate BEFORE TRUNCATE ON firma_privada.eventos_firma FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_consentimiento BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.consentimientos_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_consentimiento_truncate BEFORE TRUNCATE ON firma_privada.consentimientos_firma FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_firma_electronica BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.firmas_electronicas FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_firma_electronica_truncate BEFORE TRUNCATE ON firma_privada.firmas_electronicas FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_pdf_final BEFORE INSERT OR UPDATE OR DELETE ON firma_privada.pdfs_finales_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.proteger_apendice();
CREATE TRIGGER firma_2c_pdf_final_truncate BEFORE TRUNCATE ON firma_privada.pdfs_finales_firma FOR EACH STATEMENT EXECUTE FUNCTION firma_privada.proteger_apendice();

-- Alta de la firma: también para el propietario fuera de RPC, exige invitación viva, OTP recién consumido y firmante pendiente.
CREATE FUNCTION firma_privada.comprobar_firma_electronica() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE id=NEW.proceso_firma_id AND estado='PENDIENTE' AND metodo='ELECTRONICA_SIMPLE')
  OR NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE id=NEW.firmante_id AND estado='PENDIENTE' AND persona_firmante_id=NEW.persona_firmante_id)
  OR NOT EXISTS(SELECT 1 FROM firma_privada.invitaciones_firma WHERE id=NEW.invitacion_id AND usada_at IS NULL AND revocada_at IS NULL AND expira_at>clock_timestamp() AND correo=NEW.correo)
  OR NOT EXISTS(SELECT 1 FROM firma_privada.otps_firma WHERE id=NEW.otp_id AND consumido_at IS NOT NULL)
  OR NEW.sha256_evidencia IS DISTINCT FROM firma_privada.huella_firma(NEW.id,NEW.proceso_firma_id,NEW.firmante_id,NEW.invitacion_id,NEW.consentimiento_id,NEW.otp_id,
   NEW.persona_firmante_id,NEW.correo,NEW.sha256_documento,NEW.sha256_firma,NEW.firmado_at) THEN
  RAISE EXCEPTION 'Firma electrónica inconsistente';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_firma_electronica_alta BEFORE INSERT ON firma_privada.firmas_electronicas FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_firma_electronica();

-- Alta del PDF final: también para el propietario fuera de RPC, exige todas las firmas, su manifiesto vigente y el objeto real.
CREATE FUNCTION firma_privada.comprobar_pdf_final() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE id=NEW.proceso_firma_id AND contrato_id=NEW.contrato_id AND estado='PENDIENTE' AND metodo='ELECTRONICA_SIMPLE')
  OR NOT firma_privada.todas_firmadas(NEW.proceso_firma_id)
  OR NEW.manifiesto IS DISTINCT FROM firma_privada.manifiesto_firmas(NEW.proceso_firma_id)
  OR NEW.sha256_manifiesto IS DISTINCT FROM firma_privada.sha256_texto(NEW.manifiesto::text)
  OR (firma_privada.objeto_pdf(NEW.storage_path,NEW.size_bytes)->>'id')::uuid IS DISTINCT FROM NEW.storage_object_id THEN
  RAISE EXCEPTION 'PDF final inconsistente';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER firma_2c_pdf_final_alta BEFORE INSERT ON firma_privada.pdfs_finales_firma FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_pdf_final();

-- ---------------------------------------------------------------- lista blanca ampliada (triggers de la etapa 1)
-- Se mantiene el criterio de 02: solo el propietario escribe, y una escritura directa de clientes se rechaza.
-- Se añaden únicamente: PENDIENTE->COMPLETADO y PENDIENTE->ANULADO (proceso), PENDIENTE->FIRMADO con evidencia
-- (firmante), y PENDIENTE_FIRMA->FIRMADO y PENDIENTE_FIRMA->CANCELADO solo tras una anulación (contrato).
CREATE OR REPLACE FUNCTION firma_privada.proteger_proceso() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_mutable text[]:=ARRAY['estado','completado_at','pdf_final_id','sha256_documento_firmado','pdf_final_at','cancelado_at','cancelado_por','motivo_cancelacion',
 'anulado_at','anulado_por','motivo_anulacion','destino_contrato_anulacion','updated_at'];
 v_signed boolean; v_evidence boolean;
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid=TG_RELID) THEN
  RAISE EXCEPTION 'Escritura de firma solo mediante RPC' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'No se elimina auditoría de firma'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.estado<>'PENDIENTE' OR NEW.metodo<>'ELECTRONICA_SIMPLE'
   OR NOT EXISTS(SELECT 1 FROM public.documentos_contrato WHERE id=NEW.documento_origen_id AND contrato_id=NEW.contrato_id)
   OR NOT EXISTS(SELECT 1 FROM firma_privada.validaciones WHERE id=NEW.validacion_id AND contrato_id=NEW.contrato_id
    AND documento_id=NEW.documento_origen_id AND usado_por IS NULL AND sha256=NEW.sha256_documento_origen) THEN
   RAISE EXCEPTION 'Proceso inconsistente';
  END IF;
  -- Un PDF con firmas anuladas no vuelve a circular: el nuevo proceso exige otra revisión.
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
  IF NOT (v_signed OR v_evidence) THEN RAISE EXCEPTION 'Proceso sin firmas: se cancela, no se anula'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=NEW.anulado_por AND role='admin') THEN
   RAISE EXCEPTION 'La anulación requiere administrador' USING ERRCODE='42501';
  END IF;
 ELSIF NEW.estado='COMPLETADO' THEN
  IF OLD.metodo<>'ELECTRONICA_SIMPLE' OR NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=OLD.id AND requerido)
   OR EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=OLD.id AND f.requerido AND (f.estado<>'FIRMADO'
    OR NOT EXISTS(SELECT 1 FROM firma_privada.firmas_electronicas e WHERE e.firmante_id=f.id AND e.proceso_firma_id=OLD.id AND e.sha256_documento=OLD.sha256_documento_origen))) THEN
   RAISE EXCEPTION 'No se completa: faltan firmas obligatorias';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM firma_privada.pdfs_finales_firma WHERE id=NEW.pdf_final_id AND proceso_firma_id=OLD.id AND sha256=NEW.sha256_documento_firmado) THEN
   RAISE EXCEPTION 'No se completa: falta el PDF final registrado';
  END IF;
 ELSIF NEW.estado<>'PENDIENTE' THEN
  RAISE EXCEPTION 'Transición de proceso no permitida: % -> %',OLD.estado,NEW.estado;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION firma_privada.proteger_firmante() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_part public.partes_contrato%ROWTYPE; v_process public.procesos_firma%ROWTYPE;
 v_mutable text[]:=ARRAY['estado','firmado_at','registrado_por','updated_at'];
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
 -- UPDATE: único paso PENDIENTE -> FIRMADO, respaldado por su evidencia sobre el hash del proceso.
 IF OLD.estado<>'PENDIENTE' OR NEW.estado<>'FIRMADO' OR (to_jsonb(OLD)-v_mutable) IS DISTINCT FROM (to_jsonb(NEW)-v_mutable) THEN
  RAISE EXCEPTION 'Firmante: solo un registro PENDIENTE -> FIRMADO; identidad inmutable';
 END IF;
 IF v_process.estado IS DISTINCT FROM 'PENDIENTE' THEN RAISE EXCEPTION 'Firma solo en procesos pendientes'; END IF;
 IF NOT EXISTS(SELECT 1 FROM firma_privada.firmas_electronicas e WHERE e.firmante_id=OLD.id AND e.proceso_firma_id=OLD.proceso_firma_id
   AND e.sha256_documento=v_process.sha256_documento_origen AND e.firmado_at=NEW.firmado_at) THEN
  RAISE EXCEPTION 'Firmante sin evidencia de firma electrónica';
 END IF;
 RETURN NEW;
END $$;

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

-- Coherencia al COMMIT, adicional a comprobar_transicion (que no cambia): también para el propietario fuera de RPC.
CREATE FUNCTION firma_privada.comprobar_cierre_electronico() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_cid uuid; v_state text;
BEGIN
 IF TG_TABLE_NAME='contratos' THEN v_cid:=NEW.id;
 ELSIF TG_TABLE_NAME='procesos_firma' THEN v_cid:=NEW.contrato_id;
 ELSE SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=NEW.proceso_firma_id; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.procesos_firma p WHERE p.contrato_id=v_cid AND p.estado='COMPLETADO' AND (
    v_state IN('BORRADOR','PENDIENTE_FIRMA','CANCELADO')
    OR NOT EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.requerido)
    OR NOT EXISTS(SELECT 1 FROM firma_privada.pdfs_finales_firma d WHERE d.id=p.pdf_final_id AND d.proceso_firma_id=p.id AND d.sha256=p.sha256_documento_firmado)
    OR EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.requerido AND (f.estado<>'FIRMADO'
     OR NOT EXISTS(SELECT 1 FROM firma_privada.firmas_electronicas e WHERE e.firmante_id=f.id AND e.proceso_firma_id=p.id AND e.sha256_documento=p.sha256_documento_origen)))))
  OR (v_state='FIRMADO' AND EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=v_cid)
    AND NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE contrato_id=v_cid AND estado='COMPLETADO'))
  OR EXISTS(SELECT 1 FROM public.procesos_firma p WHERE p.contrato_id=v_cid AND p.estado='CANCELADO'
    AND EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.estado<>'PENDIENTE'))
  OR EXISTS(SELECT 1 FROM public.procesos_firma p WHERE p.contrato_id=v_cid AND p.estado='ANULADO'
    AND NOT EXISTS(SELECT 1 FROM public.firmantes_proceso f WHERE f.proceso_firma_id=p.id AND f.estado<>'PENDIENTE')) THEN
  RAISE EXCEPTION 'Proceso de firma completado/cancelado/anulado inconsistente con contrato o firmas';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER firma_2c_cierre_proceso AFTER INSERT OR UPDATE ON public.procesos_firma DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_cierre_electronico();
CREATE CONSTRAINT TRIGGER firma_2c_cierre_firmante AFTER UPDATE ON public.firmantes_proceso DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_cierre_electronico();
CREATE CONSTRAINT TRIGGER firma_2c_cierre_contrato AFTER UPDATE ON public.contratos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION firma_privada.comprobar_cierre_electronico();

-- ---------------------------------------------------------------- RPC del administrador (vía servidor)
-- Orden de bloqueo común (también iniciar/cancelar de la etapa 1):
--   contrato FOR UPDATE -> proceso FOR UPDATE -> firmante -> invitación -> OTP.
-- Bloquear primero el contrato serializa toda la firma de un contrato, incluidos los intentos de OTP.

-- EXECUTE solo service_role: el servidor autentica al administrador (p_actor), genera el token aleatorio y envía
-- solo su hash. La invitación va siempre al correo vigente del firmante: esta RPC no acepta ningún correo.
-- Sustituye a la invitación viva anterior.
CREATE FUNCTION public.emitir_invitacion_firma(p_actor uuid,p_proceso uuid,p_firmante uuid,p_token_hash text,p_vigencia_horas integer DEFAULT 72)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE; v_signer public.firmantes_proceso%ROWTYPE;
 v_inv firma_privada.invitaciones_firma%ROWTYPE; v_previous firma_privada.invitaciones_firma%ROWTYPE; v_now timestamptz:=clock_timestamp();
 v_email text;
BEGIN
 PERFORM firma_privada.exigir_admin(p_actor);
 IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Hash de token inválido'; END IF;
 IF p_vigencia_horas IS NULL OR p_vigencia_horas NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Vigencia inválida: de 1 a 168 horas'; END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF v_process.metodo<>'ELECTRONICA_SIMPLE' THEN
  RAISE EXCEPTION 'Proceso iniciado antes de la firma electrónica: cancélalo e inicia uno nuevo';
 END IF;
 SELECT * INTO v_signer FROM public.firmantes_proceso WHERE id=p_firmante FOR UPDATE;
 IF NOT FOUND OR v_signer.proceso_firma_id IS DISTINCT FROM p_proceso THEN RAISE EXCEPTION 'Firmante ajeno al proceso o inexistente'; END IF;
 IF v_signer.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'El firmante ya firmó'; END IF;
 v_email:=firma_privada.correo_vigente(p_firmante);
 IF v_email IS NULL OR length(v_email)>320 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN
  RAISE EXCEPTION 'El firmante no tiene un correo válido: registra el cambio con cambiar_correo_firmante' USING ERRCODE='RF007';
 END IF;
 SELECT * INTO v_previous FROM firma_privada.invitaciones_firma WHERE firmante_id=p_firmante AND usada_at IS NULL AND revocada_at IS NULL FOR UPDATE;
 IF FOUND THEN
  UPDATE firma_privada.invitaciones_firma SET revocada_at=v_now,revocada_por=p_actor,motivo_revocacion='Sustituida por una invitación nueva' WHERE id=v_previous.id;
  PERFORM firma_privada.registrar_evento(v_previous,'INVITACION_REVOCADA',NULL,p_actor,NULL,NULL,'{"motivo":"SUSTITUIDA"}');
 END IF;
 INSERT INTO firma_privada.invitaciones_firma(proceso_firma_id,firmante_id,token_hash,correo,emitida_por,emitida_at,expira_at)
 VALUES(p_proceso,p_firmante,p_token_hash,v_email,p_actor,v_now,v_now+make_interval(hours=>p_vigencia_horas)) RETURNING * INTO v_inv;
 PERFORM firma_privada.registrar_evento(v_inv,'INVITACION_EMITIDA',v_process.sha256_documento_origen,p_actor,NULL,NULL);
 RETURN jsonb_build_object('invitacion_id',v_inv.id,'correo',v_inv.correo,'expira_at',v_inv.expira_at);
END $$;

-- Cambio expreso del correo de un firmante pendiente, con justificación. No altera el dato congelado: queda como
-- registro propio. Revoca la invitación viva, porque su enlace salió a la dirección anterior; después hay que emitir otra.
CREATE FUNCTION public.cambiar_correo_firmante(p_actor uuid,p_proceso uuid,p_firmante uuid,p_correo text,p_justificacion text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE; v_signer public.firmantes_proceso%ROWTYPE;
 v_live firma_privada.invitaciones_firma%ROWTYPE; v_now timestamptz:=clock_timestamp(); v_email text:=lower(btrim(p_correo));
 v_reason text:=btrim(p_justificacion); v_current text; v_change uuid; v_revoked boolean;
BEGIN
 PERFORM firma_privada.exigir_admin(p_actor);
 IF v_email IS NULL OR length(v_email)>320 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN RAISE EXCEPTION 'Correo inválido'; END IF;
 IF v_reason IS NULL OR length(v_reason) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Justificación obligatoria (10 a 1000 caracteres)'; END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF v_process.metodo<>'ELECTRONICA_SIMPLE' THEN
  RAISE EXCEPTION 'Proceso iniciado antes de la firma electrónica: cancélalo e inicia uno nuevo';
 END IF;
 SELECT * INTO v_signer FROM public.firmantes_proceso WHERE id=p_firmante FOR UPDATE;
 IF NOT FOUND OR v_signer.proceso_firma_id IS DISTINCT FROM p_proceso THEN RAISE EXCEPTION 'Firmante ajeno al proceso o inexistente'; END IF;
 IF v_signer.estado<>'PENDIENTE' THEN RAISE EXCEPTION 'El firmante ya firmó'; END IF;
 v_current:=firma_privada.correo_vigente(p_firmante);
 IF v_current IS NOT DISTINCT FROM v_email THEN RAISE EXCEPTION 'Ese ya es el correo vigente del firmante'; END IF;
 INSERT INTO firma_privada.cambios_correo_firmante(proceso_firma_id,firmante_id,correo_anterior,correo_nuevo,justificacion,cambiado_por,cambiado_at)
 VALUES(p_proceso,p_firmante,v_current,v_email,v_reason,p_actor,v_now) RETURNING id INTO v_change;
 SELECT * INTO v_live FROM firma_privada.invitaciones_firma WHERE firmante_id=p_firmante AND usada_at IS NULL AND revocada_at IS NULL FOR UPDATE;
 v_revoked:=FOUND;
 IF v_revoked THEN
  UPDATE firma_privada.invitaciones_firma SET revocada_at=v_now,revocada_por=p_actor,motivo_revocacion='Cambio de correo del firmante' WHERE id=v_live.id;
  PERFORM firma_privada.registrar_evento(v_live,'INVITACION_REVOCADA',NULL,p_actor,NULL,NULL,jsonb_build_object('motivo','CAMBIO_CORREO','cambio_id',v_change));
 END IF;
 RETURN jsonb_build_object('cambio_id',v_change,'correo',v_email,'invitacion_revocada',v_revoked);
END $$;

CREATE FUNCTION public.revocar_invitacion_firma(p_actor uuid,p_invitacion uuid,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_pid uuid; v_fid uuid; v_cid uuid; v_inv firma_privada.invitaciones_firma%ROWTYPE; v_reason text:=btrim(p_motivo);
BEGIN
 PERFORM firma_privada.exigir_admin(p_actor);
 IF v_reason IS NULL OR length(v_reason) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Motivo obligatorio (máximo 1000 caracteres)'; END IF;
 SELECT i.proceso_firma_id,i.firmante_id,p.contrato_id INTO v_pid,v_fid,v_cid FROM firma_privada.invitaciones_firma i
  JOIN public.procesos_firma p ON p.id=i.proceso_firma_id WHERE i.id=p_invitacion;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitación inexistente'; END IF;
 PERFORM 1 FROM public.contratos WHERE id=v_cid FOR UPDATE;
 PERFORM 1 FROM public.procesos_firma WHERE id=v_pid FOR UPDATE;
 PERFORM 1 FROM public.firmantes_proceso WHERE id=v_fid FOR UPDATE;
 SELECT * INTO v_inv FROM firma_privada.invitaciones_firma WHERE id=p_invitacion FOR UPDATE;
 IF v_inv.usada_at IS NOT NULL OR v_inv.revocada_at IS NOT NULL THEN RAISE EXCEPTION 'La invitación ya se usó o ya está revocada'; END IF;
 UPDATE firma_privada.invitaciones_firma SET revocada_at=clock_timestamp(),revocada_por=p_actor,motivo_revocacion=v_reason WHERE id=p_invitacion;
 PERFORM firma_privada.registrar_evento(v_inv,'INVITACION_REVOCADA',NULL,p_actor,NULL,NULL);
END $$;

-- Evidencia completa de un proceso, sin hash de token ni HMAC de OTP.
CREATE FUNCTION public.consultar_evidencia_firma(p_actor uuid,p_proceso uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM firma_privada.exigir_admin(p_actor);
 IF NOT EXISTS(SELECT 1 FROM public.procesos_firma WHERE id=p_proceso) THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 RETURN jsonb_build_object(
  'cambios_correo',(SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.cambiado_at,k.id),'[]') FROM firma_privada.cambios_correo_firmante k WHERE k.proceso_firma_id=p_proceso),
  'invitaciones',(SELECT coalesce(jsonb_agg(to_jsonb(i)-'token_hash' ORDER BY i.emitida_at,i.id),'[]') FROM firma_privada.invitaciones_firma i WHERE i.proceso_firma_id=p_proceso),
  'consentimientos',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.otorgado_at,c.id),'[]') FROM firma_privada.consentimientos_firma c WHERE c.proceso_firma_id=p_proceso),
  'pdf_final',(SELECT to_jsonb(d) FROM firma_privada.pdfs_finales_firma d WHERE d.proceso_firma_id=p_proceso),
  'firmas',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'firma_png' ORDER BY f.firmado_at,f.id),'[]') FROM firma_privada.firmas_electronicas f WHERE f.proceso_firma_id=p_proceso),
  'eventos',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.ocurrido_at,e.id),'[]') FROM firma_privada.eventos_firma e WHERE e.proceso_firma_id=p_proceso));
END $$;

-- Imagen de una firma, para mostrarla a un administrador. consultar_evidencia_firma solo devuelve su hash.
CREATE FUNCTION public.obtener_firma_dibujada(p_actor uuid,p_firma uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM firma_privada.exigir_admin(p_actor);
 SELECT jsonb_build_object('firma_id',e.id,'mime_type','image/png','imagen_base64',encode(e.firma_png,'base64'),'sha256_firma',e.sha256_firma,'sha256_evidencia',e.sha256_evidencia)
 INTO v_result FROM firma_privada.firmas_electronicas e WHERE e.id=p_firma;
 IF v_result IS NULL THEN RAISE EXCEPTION 'Firma inexistente'; END IF;
 RETURN v_result;
END $$;

-- ---------------------------------------------------------------- RPC del firmante (vía servidor, solo service_role)
-- El firmante se identifica por el enlace y el OTP enviados al correo de la invitación, y su persona es la
-- congelada en firmantes_proceso. No interviene ninguna cuenta de usuario: no se consulta users.persona_id.

-- Datos para la página de firma y para que el servidor descargue el PDF exacto.
CREATE FUNCTION public.abrir_invitacion_firma(p_token_hash text,p_ip inet DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_inv firma_privada.invitaciones_firma%ROWTYPE; v_process public.procesos_firma%ROWTYPE; v_signer public.firmantes_proceso%ROWTYPE;
 v_folio text; v_otp firma_privada.otps_firma%ROWTYPE; v_now timestamptz;
BEGIN
 v_inv:=firma_privada.invitacion_bloqueada(p_token_hash);
 v_now:=clock_timestamp();
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=v_inv.proceso_firma_id;
 SELECT * INTO v_signer FROM public.firmantes_proceso WHERE id=v_inv.firmante_id;
 SELECT folio INTO v_folio FROM public.contratos WHERE id=v_process.contrato_id;
 SELECT * INTO v_otp FROM firma_privada.otps_firma WHERE invitacion_id=v_inv.id AND invalidado_at IS NULL AND consumido_at IS NULL;
 PERFORM firma_privada.registrar_evento(v_inv,'INVITACION_ABIERTA',NULL,NULL,p_ip,p_user_agent);
 RETURN jsonb_build_object('invitacion_id',v_inv.id,'proceso_id',v_inv.proceso_firma_id,'firmante_id',v_inv.firmante_id,'contrato_id',v_process.contrato_id,
  'folio',v_folio,'documento_id',v_process.documento_origen_id,'storage_path',v_process.storage_path_origen,
  'sha256_documento',v_process.sha256_documento_origen,'size_bytes',v_process.size_bytes_origen,
  'nombre_firmante',firma_privada.nombre_firmante(v_signer.snapshot),'nombre_entidad',v_signer.nombre_entidad,'rol',v_signer.rol,'caracter',v_signer.caracter,
  'correo_parcial',firma_privada.correo_enmascarado(v_inv.correo),'expira_at',v_inv.expira_at,
  'consentimiento_version','CONSENTIMIENTO_FES_V2','consentimiento_texto',firma_privada.consentimiento_invitacion(v_inv),
  'visualizado',EXISTS(SELECT 1 FROM firma_privada.eventos_firma e WHERE e.invitacion_id=v_inv.id AND e.tipo='DOCUMENTO_VISUALIZADO'),
  'consentido',EXISTS(SELECT 1 FROM firma_privada.consentimientos_firma c WHERE c.invitacion_id=v_inv.id),
  'otp_expira_at',CASE WHEN v_otp.expira_at>v_now THEN v_otp.expira_at END);
END $$;

-- p_sha256_calculado: SHA-256 que el servidor calculó sobre los bytes exactos entregados al firmante.
CREATE FUNCTION public.registrar_visualizacion_firma(p_token_hash text,p_sha256_calculado text,p_ip inet DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_inv firma_privada.invitaciones_firma%ROWTYPE; v_sha text;
BEGIN
 v_inv:=firma_privada.invitacion_bloqueada(p_token_hash);
 SELECT sha256_documento_origen INTO v_sha FROM public.procesos_firma WHERE id=v_inv.proceso_firma_id;
 IF p_sha256_calculado IS DISTINCT FROM v_sha THEN RAISE EXCEPTION 'El PDF entregado no coincide con el documento origen del proceso' USING ERRCODE='RF002'; END IF;
 RETURN firma_privada.registrar_evento(v_inv,'DOCUMENTO_VISUALIZADO',v_sha,NULL,p_ip,p_user_agent);
END $$;

-- Reintento con el mismo documento = idempotente (devuelve el consentimiento existente).
CREATE FUNCTION public.registrar_consentimiento_firma(p_token_hash text,p_sha256_documento text,p_version text,p_acepta boolean,p_ip inet DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_inv firma_privada.invitaciones_firma%ROWTYPE; v_sha text; v_view uuid; v_id uuid; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_acepta IS NOT TRUE THEN RAISE EXCEPTION 'Se requiere aceptación expresa' USING ERRCODE='RF003'; END IF;
 IF p_version IS DISTINCT FROM 'CONSENTIMIENTO_FES_V2' THEN RAISE EXCEPTION 'Versión de consentimiento no vigente' USING ERRCODE='RF003'; END IF;
 v_inv:=firma_privada.invitacion_bloqueada(p_token_hash);
 SELECT sha256_documento_origen INTO v_sha FROM public.procesos_firma WHERE id=v_inv.proceso_firma_id;
 IF p_sha256_documento IS DISTINCT FROM v_sha THEN RAISE EXCEPTION 'El consentimiento no corresponde al documento del proceso' USING ERRCODE='RF002'; END IF;
 SELECT id INTO v_id FROM firma_privada.consentimientos_firma WHERE invitacion_id=v_inv.id;
 IF FOUND THEN RETURN v_id; END IF;
 SELECT id INTO v_view FROM firma_privada.eventos_firma WHERE invitacion_id=v_inv.id AND tipo='DOCUMENTO_VISUALIZADO' AND sha256_documento=v_sha
  ORDER BY ocurrido_at DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'El firmante debe visualizar el documento antes de consentir' USING ERRCODE='RF003'; END IF;
 INSERT INTO firma_privada.consentimientos_firma(invitacion_id,proceso_firma_id,firmante_id,visualizacion_id,sha256_documento,version,texto,ip,user_agent,otorgado_at)
 VALUES(v_inv.id,v_inv.proceso_firma_id,v_inv.firmante_id,v_view,v_sha,p_version,firma_privada.consentimiento_invitacion(v_inv),p_ip,left(p_user_agent,512),v_now) RETURNING id INTO v_id;
 PERFORM firma_privada.registrar_evento(v_inv,'CONSENTIMIENTO_OTORGADO',v_sha,NULL,p_ip,p_user_agent,jsonb_build_object('consentimiento_id',v_id));
 RETURN v_id;
END $$;

-- p_otp_hmac = HMAC-SHA256(secreto_servidor, invitacion_id || ':' || otp). Invalida el código anterior.
-- Vigencia de 10 min, un envío cada 60 s y 5 códigos por invitación: como máximo 25 intentos por enlace.
-- Devuelve el correo guardado: el servidor envía el código solo ahí, nunca a uno indicado por el navegador.
CREATE FUNCTION public.emitir_otp_firma(p_token_hash text,p_otp_hmac text,p_ip inet DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_inv firma_privada.invitaciones_firma%ROWTYPE; v_now timestamptz; v_count integer; v_last timestamptz; v_id uuid; v_expires timestamptz;
BEGIN
 IF p_otp_hmac IS NULL OR p_otp_hmac !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'HMAC de OTP inválido'; END IF;
 v_inv:=firma_privada.invitacion_bloqueada(p_token_hash);
 v_now:=clock_timestamp();
 IF NOT EXISTS(SELECT 1 FROM firma_privada.consentimientos_firma WHERE invitacion_id=v_inv.id) THEN
  RAISE EXCEPTION 'Se requiere consentimiento antes de enviar el código' USING ERRCODE='RF003';
 END IF;
 SELECT count(*),max(emitido_at) INTO v_count,v_last FROM firma_privada.otps_firma WHERE invitacion_id=v_inv.id;
 IF v_count>=5 THEN RAISE EXCEPTION 'Límite de códigos alcanzado: solicita una invitación nueva' USING ERRCODE='RF004'; END IF;
 IF v_last>v_now-interval '60 seconds' THEN RAISE EXCEPTION 'Espera un minuto antes de pedir otro código' USING ERRCODE='RF005'; END IF;
 UPDATE firma_privada.otps_firma SET invalidado_at=v_now,motivo_invalidacion='REENVIO' WHERE invitacion_id=v_inv.id AND invalidado_at IS NULL AND consumido_at IS NULL;
 v_expires:=v_now+interval '10 minutes';
 INSERT INTO firma_privada.otps_firma(invitacion_id,otp_hmac,emitido_at,expira_at) VALUES(v_inv.id,p_otp_hmac,v_now,v_expires) RETURNING id INTO v_id;
 PERFORM firma_privada.registrar_evento(v_inv,'OTP_EMITIDO',NULL,NULL,p_ip,p_user_agent,jsonb_build_object('otp_id',v_id));
 RETURN jsonb_build_object('otp_id',v_id,'correo',v_inv.correo,'expira_at',v_expires,'codigos_restantes',4-v_count);
END $$;

-- Firma. Un código incorrecto, vencido o agotado NO lanza error: devuelve el resultado para que la transacción
-- confirme el contador y el evento (una excepción los revertiría y permitiría intentos ilimitados).
-- La firma, la imagen, el consumo del OTP y de la invitación y el estado del firmante ocurren en una sola transacción.
-- La imagen solo se guarda si el código es correcto. Una imagen inválida se rechaza antes y no consume intentos.
-- La última firma revalida el cierre y devuelve pdf_final_requerido: el servidor debe generar y registrar el PDF final.
CREATE FUNCTION public.firmar_documento_electronico(p_token_hash text,p_otp_hmac text,p_sha256_documento text,p_firma_png_base64 text,p_sha256_firma text,
 p_confirma_firma boolean,p_ip inet DEFAULT NULL,p_user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_inv firma_privada.invitaciones_firma%ROWTYPE; v_process public.procesos_firma%ROWTYPE; v_signer public.firmantes_proceso%ROWTYPE;
 v_otp firma_privada.otps_firma%ROWTYPE; v_consent uuid; v_firma uuid:=gen_random_uuid(); v_now timestamptz; v_tries integer; v_ready boolean; v_png bytea; v_evidence text; v_name text;
BEGIN
 IF p_otp_hmac IS NULL OR p_otp_hmac !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'HMAC de OTP inválido'; END IF;
 IF p_confirma_firma IS NOT TRUE THEN RAISE EXCEPTION 'El firmante debe confirmar su firma dibujada' USING ERRCODE='RF003'; END IF;
 v_png:=firma_privada.decodificar_firma(p_firma_png_base64,p_sha256_firma);
 v_inv:=firma_privada.invitacion_bloqueada(p_token_hash);
 v_now:=clock_timestamp();
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=v_inv.proceso_firma_id;
 SELECT * INTO v_signer FROM public.firmantes_proceso WHERE id=v_inv.firmante_id;
 IF p_sha256_documento IS DISTINCT FROM v_process.sha256_documento_origen THEN
  RAISE EXCEPTION 'La firma no corresponde al documento del proceso' USING ERRCODE='RF002';
 END IF;
 SELECT id INTO v_consent FROM firma_privada.consentimientos_firma WHERE invitacion_id=v_inv.id AND sha256_documento=p_sha256_documento;
 IF NOT FOUND THEN RAISE EXCEPTION 'Se requiere consentimiento antes de firmar' USING ERRCODE='RF003'; END IF;
 SELECT * INTO v_otp FROM firma_privada.otps_firma WHERE invitacion_id=v_inv.id AND invalidado_at IS NULL AND consumido_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('resultado','OTP_INEXISTENTE','intentos_restantes',0); END IF;
 IF v_otp.expira_at<=v_now THEN
  UPDATE firma_privada.otps_firma SET invalidado_at=v_now,motivo_invalidacion='VENCIDO' WHERE id=v_otp.id;
  PERFORM firma_privada.registrar_evento(v_inv,'OTP_VENCIDO',NULL,NULL,p_ip,p_user_agent,jsonb_build_object('otp_id',v_otp.id));
  RETURN jsonb_build_object('resultado','OTP_VENCIDO','intentos_restantes',0);
 END IF;
 IF v_otp.otp_hmac<>p_otp_hmac THEN
  v_tries:=v_otp.intentos+1;
  IF v_tries>=5 THEN
   UPDATE firma_privada.otps_firma SET intentos=v_tries,invalidado_at=v_now,motivo_invalidacion='AGOTADO' WHERE id=v_otp.id;
   PERFORM firma_privada.registrar_evento(v_inv,'OTP_AGOTADO',NULL,NULL,p_ip,p_user_agent,jsonb_build_object('otp_id',v_otp.id));
   RETURN jsonb_build_object('resultado','OTP_AGOTADO','intentos_restantes',0);
  END IF;
  UPDATE firma_privada.otps_firma SET intentos=v_tries WHERE id=v_otp.id;
  PERFORM firma_privada.registrar_evento(v_inv,'OTP_FALLIDO',NULL,NULL,p_ip,p_user_agent,jsonb_build_object('otp_id',v_otp.id,'intento',v_tries));
  RETURN jsonb_build_object('resultado','OTP_INCORRECTO','intentos_restantes',5-v_tries);
 END IF;
 UPDATE firma_privada.otps_firma SET consumido_at=v_now WHERE id=v_otp.id;
 v_name:=firma_privada.nombre_firmante(v_signer.snapshot);
 v_evidence:=firma_privada.huella_firma(v_firma,v_inv.proceso_firma_id,v_inv.firmante_id,v_inv.id,v_consent,v_otp.id,v_signer.persona_firmante_id,v_inv.correo,p_sha256_documento,p_sha256_firma,v_now);
 INSERT INTO firma_privada.firmas_electronicas(id,proceso_firma_id,firmante_id,invitacion_id,consentimiento_id,otp_id,sha256_documento,persona_firmante_id,nombre_firmante,correo,
  firma_png,sha256_firma,sha256_evidencia,ip,user_agent,firmado_at)
 VALUES(v_firma,v_inv.proceso_firma_id,v_inv.firmante_id,v_inv.id,v_consent,v_otp.id,p_sha256_documento,v_signer.persona_firmante_id,v_name,v_inv.correo,
  v_png,p_sha256_firma,v_evidence,p_ip,left(p_user_agent,512),v_now);
 UPDATE firma_privada.invitaciones_firma SET usada_at=v_now WHERE id=v_inv.id;
 UPDATE public.firmantes_proceso SET estado='FIRMADO',firmado_at=v_now,registrado_por=v_inv.emitida_por,updated_at=v_now WHERE id=v_inv.firmante_id;
 PERFORM firma_privada.registrar_evento(v_inv,'FIRMA_REGISTRADA',p_sha256_documento,NULL,p_ip,p_user_agent,jsonb_build_object('firma_id',v_firma,'sha256_firma',p_sha256_firma,'sha256_evidencia',v_evidence));
 PERFORM 1 FROM public.firmantes_proceso WHERE proceso_firma_id=v_inv.proceso_firma_id ORDER BY id FOR UPDATE;
 v_ready:=firma_privada.todas_firmadas(v_inv.proceso_firma_id);
 -- Una anomalía revierte la última firma y deja el proceso como estaba, antes de generar ningún PDF.
 IF v_ready THEN PERFORM firma_privada.validar_cierre(v_process); END IF;
 RETURN jsonb_build_object('resultado','FIRMADO','firma_id',v_firma,'firmado_at',v_now,'intentos_restantes',0,'sha256_firma',p_sha256_firma,'sha256_evidencia',v_evidence,'pdf_final_requerido',v_ready,
  'firmantes_pendientes',(SELECT count(*) FROM public.firmantes_proceso WHERE proceso_firma_id=v_inv.proceso_firma_id AND requerido AND estado<>'FIRMADO'));
END $$;

-- ---------------------------------------------------------------- PDF final y cierre automático (solo service_role)
-- Tras la última firma el servidor, sin intervención de un administrador: pide los datos, descarga el PDF origen y
-- comprueba su hash, incorpora las firmas y sha256_manifiesto, sube el resultado a ruta_pdf_final con upsert=false, y lo
-- registra. Si la ruta ya existe por un intento anterior, descarga ese objeto y registra su hash: no hay un segundo PDF.
-- El proceso sigue PENDIENTE y anulable hasta el registro; si algo falla, se reintenta sin perder ninguna firma.

-- Procesos con todas las firmas y sin PDF final, para reintentar lo que quedó a medias.
CREATE FUNCTION public.listar_procesos_por_finalizar(p_limite integer DEFAULT 100)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(x.id ORDER BY x.iniciado_at,x.id),'[]'::jsonb) FROM (
  SELECT p.id,p.iniciado_at FROM public.procesos_firma p
  WHERE p.estado='PENDIENTE' AND p.metodo='ELECTRONICA_SIMPLE' AND firma_privada.todas_firmadas(p.id)
  ORDER BY p.iniciado_at,p.id LIMIT least(greatest(coalesce(p_limite,100),1),500)) x
$$;

CREATE FUNCTION public.datos_pdf_final_firma(p_proceso uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_process public.procesos_firma%ROWTYPE; v_manifest jsonb;
BEGIN
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 IF v_process.estado<>'PENDIENTE' OR v_process.metodo<>'ELECTRONICA_SIMPLE' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF NOT firma_privada.todas_firmadas(p_proceso) THEN RAISE EXCEPTION 'Faltan firmas obligatorias' USING ERRCODE='RF006'; END IF;
 PERFORM firma_privada.validar_cierre(v_process);
 v_manifest:=firma_privada.manifiesto_firmas(p_proceso);
 RETURN jsonb_build_object('proceso_id',p_proceso,'contrato_id',v_process.contrato_id,'documento_id',v_process.documento_origen_id,
  'storage_path_origen',v_process.storage_path_origen,'sha256_documento_origen',v_process.sha256_documento_origen,
  'ruta_pdf_final',v_process.contrato_id::text||'/firmas/'||p_proceso::text||'/firmado.pdf',
  'manifiesto',v_manifest,'sha256_manifiesto',firma_privada.sha256_texto(v_manifest::text),
  'imagenes',(SELECT jsonb_agg(jsonb_build_object('firma_id',e.id,'mime_type','image/png','imagen_base64',encode(e.firma_png,'base64'),'sha256_firma',e.sha256_firma) ORDER BY e.firmante_id)
   FROM firma_privada.firmas_electronicas e WHERE e.proceso_firma_id=p_proceso));
END $$;

-- Única vía a COMPLETADO y, por tanto, a FIRMADO: registra el PDF final, completa el proceso y cambia el contrato en una
-- sola transacción. Reintento con el mismo hash = idempotente.
CREATE FUNCTION public.registrar_pdf_final_firma(p_proceso uuid,p_sha256_documento_origen text,p_sha256_manifiesto text,p_sha256_final text,p_size_bytes bigint,p_generador text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_cid uuid; v_state text; v_process public.procesos_firma%ROWTYPE; v_manifest jsonb; v_path text; v_object jsonb; v_id uuid;
 v_now timestamptz:=clock_timestamp(); v_inv firma_privada.invitaciones_firma%ROWTYPE;
BEGIN
 IF p_sha256_final IS NULL OR p_sha256_final !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'SHA-256 del PDF final inválido' USING ERRCODE='RF009'; END IF;
 IF p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 10485760 THEN RAISE EXCEPTION 'Tamaño del PDF final inválido' USING ERRCODE='RF009'; END IF;
 IF nullif(btrim(p_generador),'') IS NULL OR length(p_generador)>200 THEN RAISE EXCEPTION 'Generador obligatorio (máximo 200 caracteres)' USING ERRCODE='RF009'; END IF;
 SELECT contrato_id INTO v_cid FROM public.procesos_firma WHERE id=p_proceso;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proceso inexistente'; END IF;
 SELECT estado::text INTO v_state FROM public.contratos WHERE id=v_cid FOR UPDATE;
 SELECT * INTO v_process FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE;
 IF v_process.estado='COMPLETADO' AND v_process.sha256_documento_firmado=p_sha256_final THEN
  RETURN jsonb_build_object('pdf_final_id',v_process.pdf_final_id,'sha256',p_sha256_final,'ya_registrado',true);
 END IF;
 IF v_process.estado<>'PENDIENTE' OR v_state IS DISTINCT FROM 'PENDIENTE_FIRMA' THEN RAISE EXCEPTION 'Proceso/contrato no pendiente'; END IF;
 IF v_process.metodo<>'ELECTRONICA_SIMPLE' THEN RAISE EXCEPTION 'Proceso iniciado antes de la firma electrónica: cancélalo e inicia uno nuevo'; END IF;
 PERFORM 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso ORDER BY id FOR UPDATE;
 IF NOT firma_privada.todas_firmadas(p_proceso) THEN RAISE EXCEPTION 'Faltan firmas obligatorias' USING ERRCODE='RF006'; END IF;
 PERFORM firma_privada.validar_cierre(v_process);
 IF p_sha256_documento_origen IS DISTINCT FROM v_process.sha256_documento_origen THEN RAISE EXCEPTION 'El PDF no se generó desde el documento origen del proceso' USING ERRCODE='RF009'; END IF;
 IF p_sha256_final=v_process.sha256_documento_origen THEN RAISE EXCEPTION 'El PDF final es el documento origen sin firmas' USING ERRCODE='RF009'; END IF;
 v_manifest:=firma_privada.manifiesto_firmas(p_proceso);
 IF p_sha256_manifiesto IS DISTINCT FROM firma_privada.sha256_texto(v_manifest::text) THEN RAISE EXCEPTION 'El PDF no se generó con las firmas vigentes del proceso' USING ERRCODE='RF009'; END IF;
 v_path:=v_cid::text||'/firmas/'||p_proceso::text||'/firmado.pdf';
 v_object:=firma_privada.objeto_pdf(v_path,p_size_bytes);
 IF v_object IS NULL THEN RAISE EXCEPTION 'El PDF final no existe en Storage o su tamaño/tipo no coincide' USING ERRCODE='RF009'; END IF;
 INSERT INTO firma_privada.pdfs_finales_firma(proceso_firma_id,contrato_id,sha256_documento_origen,sha256,size_bytes,mime_type,storage_path,storage_object_id,storage_etag,manifiesto,sha256_manifiesto,generador,registrado_at)
 VALUES(p_proceso,v_cid,v_process.sha256_documento_origen,p_sha256_final,p_size_bytes,'application/pdf',v_path,(v_object->>'id')::uuid,v_object->>'etag',v_manifest,p_sha256_manifiesto,btrim(p_generador),v_now)
 RETURNING id INTO v_id;
 UPDATE public.procesos_firma SET estado='COMPLETADO',completado_at=v_now,pdf_final_id=v_id,sha256_documento_firmado=p_sha256_final,pdf_final_at=v_now,updated_at=v_now WHERE id=p_proceso;
 UPDATE public.contratos SET estado='FIRMADO' WHERE id=v_cid;
 SELECT i.* INTO v_inv FROM firma_privada.invitaciones_firma i JOIN firma_privada.firmas_electronicas e ON e.invitacion_id=i.id
  WHERE e.proceso_firma_id=p_proceso ORDER BY e.firmado_at DESC,e.id DESC LIMIT 1;
 PERFORM firma_privada.registrar_evento(v_inv,'PROCESO_COMPLETADO',v_process.sha256_documento_origen,NULL,NULL,NULL,jsonb_build_object('pdf_final_id',v_id,'sha256_pdf_final',p_sha256_final,'sha256_manifiesto',p_sha256_manifiesto));
 -- Documento origen intacto (PARA_FIRMA/GENERADO).
 RETURN jsonb_build_object('pdf_final_id',v_id,'sha256',p_sha256_final,'ya_registrado',false);
END $$;

-- ---------------------------------------------------------------- anulación (sesión del administrador)
-- Salida de un proceso con firmas parciales, que cancelar_proceso_firma no admite. Conserva toda la evidencia e
-- invalida las invitaciones vivas (el proceso deja de estar PENDIENTE). El contrato va al destino elegido:
--   BORRADOR  -> se corrige y se reinicia sobre una revisión nueva del documento;
--   CANCELADO -> la operación no seguirá.
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
 IF NOT EXISTS(SELECT 1 FROM public.firmantes_proceso WHERE proceso_firma_id=p_proceso AND estado='FIRMADO') THEN
  RAISE EXCEPTION 'Proceso sin firmas: usa cancelar_proceso_firma';
 END IF;
 UPDATE public.procesos_firma SET estado='ANULADO',anulado_at=v_now,anulado_por=v_actor,motivo_anulacion=v_reason,
  destino_contrato_anulacion=p_destino_contrato,updated_at=v_now WHERE id=p_proceso;
 IF p_destino_contrato='BORRADOR' THEN
  UPDATE public.contratos SET estado='BORRADOR' WHERE id=v_cid;
 ELSE
  UPDATE public.contratos SET estado='CANCELADO' WHERE id=v_cid;
 END IF;
END $$;

-- ---------------------------------------------------------------- privilegios
-- Ninguna tabla gana privilegios: los clientes solo leen las públicas (RLS de la etapa 1) y nadie accede a las privadas.
REVOKE ALL ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.procesos_firma,public.firmantes_proceso,public.evidencias_firma TO authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA firma_privada FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.emitir_invitacion_firma(uuid,uuid,uuid,text,integer),
 public.cambiar_correo_firmante(uuid,uuid,uuid,text,text),
 public.revocar_invitacion_firma(uuid,uuid,text),
 public.consultar_evidencia_firma(uuid,uuid),
 public.abrir_invitacion_firma(text,inet,text),
 public.registrar_visualizacion_firma(text,text,inet,text),
 public.registrar_consentimiento_firma(text,text,text,boolean,inet,text),
 public.emitir_otp_firma(text,text,inet,text),
 public.firmar_documento_electronico(text,text,text,text,text,boolean,inet,text),
 public.obtener_firma_dibujada(uuid,uuid),
 public.listar_procesos_por_finalizar(integer),
 public.datos_pdf_final_firma(uuid),
 public.registrar_pdf_final_firma(uuid,text,text,text,bigint,text),
 public.anular_proceso_firma(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.emitir_invitacion_firma(uuid,uuid,uuid,text,integer),
 public.cambiar_correo_firmante(uuid,uuid,uuid,text,text),
 public.revocar_invitacion_firma(uuid,uuid,text),
 public.consultar_evidencia_firma(uuid,uuid),
 public.abrir_invitacion_firma(text,inet,text),
 public.registrar_visualizacion_firma(text,text,inet,text),
 public.registrar_consentimiento_firma(text,text,text,boolean,inet,text),
 public.emitir_otp_firma(text,text,inet,text),
 public.firmar_documento_electronico(text,text,text,text,text,boolean,inet,text),
 public.obtener_firma_dibujada(uuid,uuid),
 public.listar_procesos_por_finalizar(integer),
 public.datos_pdf_final_firma(uuid),
 public.registrar_pdf_final_firma(uuid,text,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.anular_proceso_firma(uuid,text,text) TO authenticated;

-- Comprobación final: ACL efectivo de todo 2C y que lo que no debía cambiar no cambió.
DO $postflight$
DECLARE v_bad text; v_auth oid:='authenticated'::regrole; v_service oid:='service_role'::regrole; v_fn text;
 v_unchanged jsonb:='{
  "firma_privada.admin_actual()": "db2646f5e7f5ced355d3337cf7127cf0",
  "firma_privada.cobertura(uuid)": "51956f1dd72708294ffad6d34e929b9f",
  "firma_privada.proteger_evidencia()": "b09124d8bed47a44e784473b1f8bc7d3",
  "firma_privada.comprobar_transicion()": "4ea2e0df939a094d47a4635548416fec",
  "public.iniciar_proceso_firma(uuid,uuid,text,uuid)": "aeac70b77e73f3d2eea5895e2641a52d",
  "public.cancelar_proceso_firma(uuid,text)": "ffd8733b8a332bd2990a0a21704ffdee"
 }';
BEGIN
 FOR v_fn IN SELECT jsonb_object_keys(v_unchanged) LOOP
  IF (SELECT md5(replace(prosrc,E'\r','')) FROM pg_proc WHERE oid=to_regprocedure(v_fn)) IS DISTINCT FROM v_unchanged->>v_fn THEN
   RAISE EXCEPTION 'La función % cambió durante la instalación',v_fn;
  END IF;
 END LOOP;
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
   OR (n.nspname='public' AND a.grantee=v_service AND p.proname IN('firma_fuentes_para_verificar','registrar_validacion_documento_firma','emitir_invitacion_firma','cambiar_correo_firmante',
    'revocar_invitacion_firma','consultar_evidencia_firma','abrir_invitacion_firma','registrar_visualizacion_firma','registrar_consentimiento_firma','emitir_otp_firma','firmar_documento_electronico',
    'obtener_firma_dibujada','listar_procesos_por_finalizar','datos_pdf_final_firma','registrar_pdf_final_firma'))
   OR (n.nspname='public' AND a.grantee=v_auth AND p.proname IN('iniciar_proceso_firma','cancelar_proceso_firma','anular_proceso_firma'))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE n.nspname='firma_privada' OR (n.nspname='public' AND p.proname IN('firma_fuentes_para_verificar','registrar_validacion_documento_firma',
   'iniciar_proceso_firma','cancelar_proceso_firma','emitir_invitacion_firma','cambiar_correo_firmante','revocar_invitacion_firma','consultar_evidencia_firma','abrir_invitacion_firma',
   'registrar_visualizacion_firma','registrar_consentimiento_firma','emitir_otp_firma','firmar_documento_electronico','anular_proceso_firma',
   'obtener_firma_dibujada','listar_procesos_por_finalizar','datos_pdf_final_firma','registrar_pdf_final_firma'))
  UNION ALL
  SELECT 'schema firma_privada',a.privilege_type,a.grantee,a.grantee=n.nspowner
  FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  WHERE n.nspname='firma_privada'
 ) x WHERE NOT x.ok;
 IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Privilegios inesperados tras instalar la firma electrónica: %',v_bad; END IF;
END $postflight$;

NOTIFY pgrst,'reload schema';
COMMIT;
