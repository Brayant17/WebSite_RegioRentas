-- SOLO LECTURA. Complementa 00_verificaciones_solo_lectura.sql para 02_infraestructura_corregida.sql.
-- Entregar al responsable de Supabase; no ejecutado por el asistente. Sin PII: solo IDs y conteos.
-- A. Versión y función sha256 nativa.
SELECT current_setting('server_version') AS version, to_regprocedure('pg_catalog.sha256(bytea)') AS sha256_nativo;
-- B. Propietario de las tablas a las que 02 agrega triggers (debe ser el rol instalador).
SELECT c.relname, pg_get_userbyid(c.relowner) AS propietario, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN('contratos','partes_contrato','documentos_contrato','versiones_plantilla');
-- C. versiones_plantilla no está en las secciones 1-4 de 00: constraints, triggers y policies.
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.versiones_plantilla'::regclass;
SELECT t.tgname, pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid) FROM pg_trigger t
WHERE t.tgrelid='public.versiones_plantilla'::regclass AND NOT t.tgisinternal;
SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN('versiones_plantilla','plantillas');
-- D. Acciones ON DELETE de las FKs hacia contratos y versiones (cascadas que atraviesan triggers 2C).
SELECT conrelid::regclass AS tabla, conname, confrelid::regclass AS referencia, confdeltype
FROM pg_constraint WHERE contype='f' AND confrelid IN('public.contratos'::regclass,'public.versiones_plantilla'::regclass,'public.documentos_contrato'::regclass);
-- E. Tipo real de estado/tipo/rol (text, enum o dominio).
SELECT table_name, column_name, data_type, udt_name, column_default, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND ((table_name='contratos' AND column_name='estado')
 OR (table_name='documentos_contrato' AND column_name IN('tipo','estado','storage_path','nombre_archivo','version_plantilla_id'))
 OR (table_name='partes_contrato' AND column_name='rol'));
-- F. Datos que el preflight o la máquina de estados rechazarían.
SELECT 'contratos_estado_null' AS caso, count(*) FROM public.contratos WHERE estado IS NULL
UNION ALL SELECT 'documentos_tipo_o_estado_null', count(*) FROM public.documentos_contrato WHERE tipo IS NULL OR estado IS NULL
UNION ALL SELECT 'documentos_para_firma_o_firmado', count(*) FROM public.documentos_contrato WHERE tipo::text IN('PARA_FIRMA','FIRMADO')
UNION ALL SELECT 'documentos_ruta_no_canonica', count(*) FROM public.documentos_contrato
 WHERE storage_path IS NOT NULL AND storage_path IS DISTINCT FROM (contrato_id::text||'/'||id::text||'/'||nombre_archivo)
UNION ALL SELECT 'documentos_sin_version', count(*) FROM public.documentos_contrato WHERE version_plantilla_id IS NULL;
-- G. Morales usadas como parte con CERO o varios representantes principales
-- (la consulta 28 de 00 solo detecta "más de uno" entre las que tienen alguno).
SELECT pc.persona_moral_id, count(r.id) FILTER (WHERE r.es_principal IS TRUE) AS principales
FROM public.partes_contrato pc LEFT JOIN public.representantes_persona_moral r ON r.persona_moral_id=pc.persona_moral_id
WHERE pc.persona_moral_id IS NOT NULL GROUP BY pc.persona_moral_id
HAVING count(r.id) FILTER (WHERE r.es_principal IS TRUE)<>1;
-- H. Cardinalidad por rol y contrato fuera de lo que la plantilla V2 nombra (1 arrendatario, 0..1 fiador).
SELECT rol, n_partes, count(*) AS contratos FROM (
 SELECT contrato_id, rol::text AS rol, count(*) AS n_partes FROM public.partes_contrato GROUP BY contrato_id, rol) x
WHERE (rol='ARRENDATARIO' AND n_partes<>1) OR (rol IN('FIADOR','OBLIGADO_SOLIDARIO','REPRESENTANTE_LEGAL'))
GROUP BY rol, n_partes ORDER BY rol, n_partes;
-- I. Funciones SECURITY DEFINER propiedad del instalador que usan SQL dinámico (pasarían el control de propietario).
SELECT p.oid::regprocedure, pg_get_userbyid(p.proowner) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prosecdef AND n.nspname NOT IN('pg_catalog','information_schema') AND pg_get_functiondef(p.oid) ~* 'EXECUTE[[:space:]]';
-- J. Privilegios por defecto que recibirían las tablas/funciones nuevas.
SELECT pg_get_userbyid(defaclrole) AS rol, defaclnamespace::regnamespace AS esquema, defaclobjtype, defaclacl FROM pg_default_acl;
