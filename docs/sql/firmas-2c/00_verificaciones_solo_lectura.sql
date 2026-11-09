-- SOLO LECTURA. Entregar al responsable de Supabase; Codex no ejecutó estas consultas.
-- 1. Columnas y defaults, incluidas claves/tipos de tablas fuente.
SELECT table_schema,table_name,column_name,data_type,udt_schema,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE (table_schema='public' AND table_name IN('contratos','partes_contrato','documentos_contrato','personas','personas_morales','representantes_persona_moral','unidades','edificios','users','versiones_plantilla'))
 OR (table_schema='storage' AND table_name IN('objects','buckets'))
ORDER BY table_schema,table_name,ordinal_position;
-- 2. Constraints, índices y triggers (revisar también las funciones de cada trigger).
SELECT conrelid::regclass AS tabla,conname,pg_get_constraintdef(oid) AS definicion FROM pg_constraint
WHERE conrelid IN(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('contratos','partes_contrato','documentos_contrato','personas','personas_morales','representantes_persona_moral'));
SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN('public','storage') AND tablename IN('contratos','partes_contrato','documentos_contrato','representantes_persona_moral','objects');
SELECT t.tgrelid::regclass AS tabla,t.tgname,pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid)
FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('contratos','partes_contrato','documentos_contrato'));
-- 3. RLS y policies, incluidos usuarios y catálogos requeridos por las lecturas admin.
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','storage') AND c.relkind='r';
SELECT * FROM pg_policies WHERE schemaname IN('public','storage') ORDER BY schemaname,tablename,policyname;
-- 4. Grants de tabla/columna y funciones. Las ACL incluyen concesiones a PUBLIC.
SELECT * FROM information_schema.table_privileges WHERE table_schema IN('public','storage') ORDER BY table_schema,table_name,grantee;
SELECT * FROM information_schema.column_privileges WHERE table_schema='public' ORDER BY table_name,column_name,grantee;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,p.proacl,pg_get_userbyid(p.proowner) AS propietario
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f';
SELECT p.oid::regprocedure,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND (p.prosecdef OR p.proname ILIKE '%contrato%' OR p.proname ILIKE '%firma%');
-- 5. Valores reales de enums; estado previo y cardinalidad/roles (sin PII).
SELECT n.nspname,t.typname,e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;
SELECT estado,count(*) FROM public.contratos GROUP BY estado;
SELECT tipo,estado,count(*) FROM public.documentos_contrato GROUP BY tipo,estado;
SELECT rol,count(*) FROM public.partes_contrato GROUP BY rol;
SELECT persona_moral_id,count(*) FROM public.representantes_persona_moral WHERE es_principal GROUP BY persona_moral_id HAVING count(*)<>1;
-- 6. Bucket privado y condiciones de tamaño/MIME; NO leer ni modificar archivos.
SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='contract-documents';
-- 7. Colisiones de nombres e integración: deben estar ausentes antes del primer despliegue.
SELECT to_regnamespace('firma_privada'),to_regclass('public.procesos_firma'),to_regclass('public.firmantes_proceso'),to_regclass('public.evidencias_firma');
SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN(current_user,'service_role','authenticated','anon');
