-- SOLO LECTURA. Guardar resultados antes de revisar/aplicar 01/02.
SELECT p.oid::regprocedure AS firma, pg_get_functiondef(p.oid) AS definicion,
       md5(pg_get_functiondef(p.oid)) AS huella_revision
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='crear_contrato_desde_solicitud';

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('contratos','partes_contrato','personas','personas_morales','participantes_solicitud','solicitudes','configuracion_sistema')
ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint WHERE conrelid IN ('public.contratos'::regclass,'public.partes_contrato'::regclass);
SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('contratos','partes_contrato');
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN
 ('contratos','partes_contrato','personas','personas_morales','representantes_persona_moral','configuracion_sistema','users');
SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN
 ('contratos','partes_contrato','personas','personas_morales','representantes_persona_moral','configuracion_sistema');
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name IN ('contratos','partes_contrato');
SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='S' ORDER BY n.nspname,c.relname;
SELECT rol,count(*) FROM public.participantes_solicitud GROUP BY rol;
SELECT rol,count(*) FROM public.partes_contrato GROUP BY rol;
SELECT 'contratos' AS tabla,count(*) FROM public.contratos
UNION ALL SELECT 'partes_contrato',count(*) FROM public.partes_contrato
UNION ALL SELECT 'documentos_contrato',count(*) FROM public.documentos_contrato;
SELECT id,folio,estado,arrendador_persona_moral_id FROM public.contratos ORDER BY created_at;
SELECT clave,valor FROM public.configuracion_sistema WHERE clave='arrendador_persona_moral_id';
