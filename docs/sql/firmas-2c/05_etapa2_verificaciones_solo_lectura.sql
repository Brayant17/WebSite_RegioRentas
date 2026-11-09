-- SOLO LECTURA. Ejecutar en el SQL Editor de Supabase ANTES de instalar 04 y 06. No ejecutado por el asistente.
-- Sin PII: solo nombres de objetos de base de datos, conteos, claves de metadata y rutas compuestas por UUID.
-- Junto a cada consulta, el resultado esperado. Cualquier diferencia se concilia antes de instalar.

-- ================================================================ ENTORNO Y ETAPA 1
-- E1. Rol y versión. Esperado: el mismo rol que instaló 02, rolbypassrls=true; PostgreSQL >= 15.
SELECT current_user, r.rolsuper, r.rolbypassrls, current_setting('server_version') AS version,
 current_setting('statement_timeout') AS statement_timeout, current_setting('lock_timeout') AS lock_timeout
FROM pg_roles r WHERE r.rolname=current_user;

-- E2. Compatibilidad con la etapa 1: huella de las funciones que 04 sustituye o de las que depende.
-- Esperado: coincide=true en las 9 filas (es exactamente la comprobación del preflight de 04).
SELECT x.fn, md5(replace(p.prosrc,E'\r','')) AS md5_instalado, x.md5_esperado,
 md5(replace(p.prosrc,E'\r',''))=x.md5_esperado AS coincide, pg_get_userbyid(p.proowner) AS propietario
FROM (VALUES
 ('firma_privada.admin_actual()','db2646f5e7f5ced355d3337cf7127cf0'),
 ('firma_privada.cobertura(uuid)','51956f1dd72708294ffad6d34e929b9f'),
 ('firma_privada.proteger_proceso()','359f22c73e9e77e089a3990eec91f61c'),
 ('firma_privada.proteger_firmante()','e6db4112d6b6d1aba9a225d19f6c69fd'),
 ('firma_privada.proteger_evidencia()','b09124d8bed47a44e784473b1f8bc7d3'),
 ('firma_privada.proteger_contrato()','84bebcb4ec33a88251f2c3d698ad83b7'),
 ('firma_privada.comprobar_transicion()','4ea2e0df939a094d47a4635548416fec'),
 ('public.iniciar_proceso_firma(uuid,uuid,text,uuid)','aeac70b77e73f3d2eea5895e2641a52d'),
 ('public.cancelar_proceso_firma(uuid,text)','ffd8733b8a332bd2990a0a21704ffdee')) x(fn,md5_esperado)
LEFT JOIN pg_proc p ON p.oid=to_regprocedure(x.fn);

-- E3. Triggers de la etapa 1. Esperado: 7 filas (+ firma_2c_parte, _documento, _version_plantilla), todas tgenabled='O'.
SELECT tgrelid::regclass AS tabla, tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'firma_2c_%' ORDER BY 1,2;

-- E4. CHECK de procesos_firma que 04 sustituye. Esperado: exactamente 2 filas con 'CANCELADO' (la lista de
-- estados y la de campos de cierre, esta con motivo_cancelacion); el resto no menciona CANCELADO.
SELECT conname, pg_get_constraintdef(oid) AS definicion, pg_get_constraintdef(oid) LIKE '%CANCELADO%' AS se_sustituye
FROM pg_constraint WHERE conrelid='public.procesos_firma'::regclass AND contype='c' ORDER BY conname;

-- E5. Datos 2C actuales. Esperado: firmantes solo PENDIENTE; 0 evidencias; ningún proceso COMPLETADO.
-- Cada contrato PENDIENTE_FIRMA tiene exactamente un proceso PENDIENTE.
SELECT 'procesos '||estado AS caso, count(*) FROM public.procesos_firma GROUP BY estado
UNION ALL SELECT 'firmantes '||estado, count(*) FROM public.firmantes_proceso GROUP BY estado
UNION ALL SELECT 'evidencias', count(*) FROM public.evidencias_firma
UNION ALL SELECT 'contratos PENDIENTE_FIRMA sin un proceso pendiente', count(*) FROM public.contratos c
 WHERE c.estado::text='PENDIENTE_FIRMA' AND (SELECT count(*) FROM public.procesos_firma p WHERE p.contrato_id=c.id AND p.estado='PENDIENTE')<>1;

-- E6. Colisiones de nombres. Esperado: 0 filas.
SELECT 'funcion' AS tipo, p.oid::regprocedure::text AS nombre FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname IN('registrar_firma_firmante','reservar_evidencia_firma','registrar_evidencia_firma',
  'completar_proceso_firma','anular_proceso_firma','listar_reservas_evidencia_vencidas','marcar_reserva_evidencia_limpiada'))
 OR (n.nspname='firma_privada' AND p.proname IN('ruta_evidencia','declaracion_evidencia','objeto_pdf','proteger_reserva','proteger_objeto_storage'))
UNION ALL SELECT 'columna', table_name||'.'||column_name FROM information_schema.columns WHERE table_schema='public'
 AND ((table_name='procesos_firma' AND column_name IN('completado_por','evidencia_firmada_id','sha256_documento_firmado','anulado_at',
   'anulado_por','motivo_anulacion','destino_contrato_anulacion'))
  OR (table_name='firmantes_proceso' AND column_name IN('registrado_at','verificacion_identidad'))
  OR (table_name='evidencias_firma' AND column_name IN('declaracion_version','declaracion_texto','storage_object_id','storage_etag')))
UNION ALL SELECT 'tabla', 'firma_privada.reservas_evidencia' WHERE to_regclass('firma_privada.reservas_evidencia') IS NOT NULL;

-- E7. Privilegios actuales de las tablas 2C. Esperado: anon sin nada; authenticated y service_role solo SELECT.
SELECT t.tabla, r.rol,
 has_table_privilege(r.rol,t.tabla,'SELECT') AS sel, has_table_privilege(r.rol,t.tabla,'INSERT') AS ins,
 has_table_privilege(r.rol,t.tabla,'UPDATE') AS upd, has_table_privilege(r.rol,t.tabla,'DELETE') AS del,
 has_table_privilege(r.rol,t.tabla,'TRUNCATE') AS trunc
FROM (VALUES('public.procesos_firma'),('public.firmantes_proceso'),('public.evidencias_firma')) t(tabla)
CROSS JOIN (VALUES('anon'),('authenticated'),('service_role')) r(rol) ORDER BY 1,2;

-- E8. Privilegios predeterminados que recibirían la tabla y las funciones nuevas (el postflight de 04 aborta si
-- dejan algo fuera de la lista blanca, pero conviene saberlo antes).
SELECT pg_get_userbyid(defaclrole) AS rol, defaclnamespace::regnamespace AS esquema, defaclobjtype, defaclacl
FROM pg_default_acl WHERE defaclnamespace IN(0,'public'::regnamespace,'firma_privada'::regnamespace);

-- ================================================================ STORAGE
-- S1. Bucket. Esperado: public=false, file_size_limit 10485760, allowed_mime_types {application/pdf}.
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='contract-documents';

-- S2. Columnas de storage.objects. Esperado: id uuid, bucket_id text, name text, metadata jsonb,
-- created_at timestamptz (las exige 04); version text si existe (la usa 06).
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema='storage' AND table_name='objects' ORDER BY ordinal_position;

-- S3. Propietario, RLS y privilegios del instalador sobre storage.objects.
-- 04 necesita solo puede_leer=true. Resultado real: propietario supabase_storage_admin, es_miembro_del_propietario=false;
-- por eso no se crean políticas ni triggers en storage.objects desde SQL (ver 06_etapa2_storage_controles_solo_lectura.sql).
SELECT c.relname, pg_get_userbyid(c.relowner) AS propietario, c.relrowsecurity, c.relforcerowsecurity,
 pg_has_role(current_user,c.relowner,'USAGE') AS es_miembro_del_propietario,
 has_table_privilege(current_user,c.oid,'SELECT') AS puede_leer, has_table_privilege(current_user,c.oid,'UPDATE') AS puede_bloquear,
 has_table_privilege(current_user,c.oid,'TRIGGER') AS puede_crear_trigger
FROM pg_class c WHERE c.oid IN('storage.objects'::regclass,'storage.buckets'::regclass);

-- S4. POLÍTICAS REALES de storage.objects y storage.buckets (la revisión que pediste).
-- Revisar cada fila con cmd en (INSERT, UPDATE, DELETE, ALL) y roles que incluyan anon, authenticated o public:
-- si su qual/with_check no excluye bucket_id='contract-documents', hoy un navegador podría escribir en el bucket.
-- Esperado tras 06: las 3 políticas contract_documents_sin_* RESTRICTIVE las neutralizan para ese bucket.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='storage' AND tablename IN('objects','buckets') ORDER BY tablename, cmd, policyname;

-- S5. Políticas de escritura que hoy alcanzan a contract-documents (resumen de S4). Esperado: 0 filas.
-- Una fila con qual/with_check NULL o sin mención del bucket se trata como "alcanza al bucket".
SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname='storage' AND tablename='objects' AND permissive='PERMISSIVE' AND cmd IN('INSERT','UPDATE','DELETE','ALL')
 AND (roles && ARRAY['anon','authenticated','public']::name[])
 AND (coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%bucket_id%'
  OR coalesce(qual,'')||coalesce(with_check,'') LIKE '%contract-documents%');

-- S6. Privilegios de tabla de los roles cliente sobre storage.objects (Supabase suele concederlos y delegar en RLS).
SELECT r.rol, has_table_privilege(r.rol,'storage.objects','SELECT') AS sel, has_table_privilege(r.rol,'storage.objects','INSERT') AS ins,
 has_table_privilege(r.rol,'storage.objects','UPDATE') AS upd, has_table_privilege(r.rol,'storage.objects','DELETE') AS del,
 (SELECT rolbypassrls FROM pg_roles WHERE rolname=r.rol) AS bypassrls
FROM (VALUES('anon'),('authenticated'),('service_role')) r(rol);

-- S7. Triggers existentes en storage.objects. Esperado: solo los de Supabase; ninguno llamado firma_2c_objeto_storage.
SELECT tgname, tgenabled, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND NOT tgisinternal ORDER BY tgname;

-- S8. Formato real de metadata en el bucket: claves y tipos. Esperado: size (number), mimetype (string) y eTag (string).
-- 04 compara metadata->>'size' con el tamaño en bytes y metadata->>'mimetype' con application/pdf, y guarda eTag.
SELECT k.key, jsonb_typeof(k.value) AS tipo, count(*) AS objetos
FROM storage.objects o CROSS JOIN LATERAL jsonb_each(o.metadata) k
WHERE o.bucket_id='contract-documents' GROUP BY 1,2 ORDER BY 1,2;

-- S9. Coherencia size/mimetype de los PDF ya generados. Esperado: todos los objetos con mimetype application/pdf
-- y size > 0 (si no, objeto_pdf no los reconocería).
SELECT o.metadata->>'mimetype' AS mimetype, (o.metadata->>'size') ~ '^[0-9]+$' AS size_entero, count(*) AS objetos
FROM storage.objects o WHERE o.bucket_id='contract-documents' GROUP BY 1,2;

-- S10. Objetos existentes bajo la ruta reservada a evidencias. Esperado: 0 filas antes de instalar.
-- Después de instalar, una fila sin evidencia ni reserva es una anomalía: revisar a mano, nunca borrar en automático.
SELECT o.name, o.created_at FROM storage.objects o WHERE o.bucket_id='contract-documents' AND o.name LIKE '%/firmas/%';

-- S11. PDF origen de procesos 2C presentes en Storage (06 los protegerá). Esperado: objeto_presente=true en todos.
SELECT p.id AS proceso, p.estado, EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='contract-documents' AND o.name=p.storage_path_origen) AS objeto_presente
FROM public.procesos_firma p ORDER BY p.iniciado_at;
