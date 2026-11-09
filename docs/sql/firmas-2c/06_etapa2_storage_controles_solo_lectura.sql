-- SOLO LECTURA. Sustituye a la propuesta anterior 06_etapa2_storage_evidencias.sql (nunca instalada), que creaba
-- políticas y un trigger en storage.objects. Con los resultados reales (storage.objects pertenece a
-- supabase_storage_admin y el instalador no es miembro), la protección del bucket NO se instala por SQL:
-- se configura en el panel y se vigila con estas consultas. Ver docs/firmas-2c-etapa2-diseno.md, "Storage".
-- No ejecutado por el asistente. Sin PII: rutas compuestas por UUID, conteos y definiciones de objetos.

-- ================================================================ P. ANTES DE INSTALAR 04 (una vez)
-- P1. Definición de los triggers existentes en storage.objects (S7 mostró on_insert_storage_object,
-- protect_objects_delete y update_objects_updated_at). on_insert_storage_object resultó ser
-- BEFORE INSERT ... WHEN (new.bucket_id = 'properties') EXECUTE FUNCTION set_storage_object_owner(): P4-P6 lo
-- analizan en detalle. Esperado: ninguno modifica name/bucket_id/metadata de contract-documents ni escribe en tablas 2C.
SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definicion_trigger,
 p.oid::regprocedure AS funcion, pg_get_userbyid(p.proowner) AS propietario_funcion, p.prosecdef, pg_get_functiondef(p.oid) AS cuerpo
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='storage.objects'::regclass AND NOT t.tgisinternal ORDER BY t.tgname;

-- P2. Políticas de escritura sobre storage.buckets para roles cliente. Esperado: 0 filas (un cliente con UPDATE
-- en buckets podría hacer público contract-documents o cambiar su límite de tamaño o MIME).
SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname='storage' AND tablename='buckets' AND cmd IN('INSERT','UPDATE','DELETE','ALL')
 AND (roles && ARRAY['anon','authenticated','public']::name[]);

-- P3. Funciones SECURITY DEFINER del esquema storage ejecutables por roles cliente (informativo: Supabase
-- expone algunas; ninguna debería escribir objetos de un bucket privado por cuenta del cliente).
SELECT p.oid::regprocedure AS funcion, pg_get_userbyid(p.proowner) AS propietario,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon, has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='storage' AND p.prosecdef ORDER BY 1;

-- P4. on_insert_storage_object y su función (set_storage_object_owner), localizada por el propio trigger
-- (no se supone su esquema). Definición completa, propietario, seguridad y privilegios.
-- Esperado: habilitado='O'; antes=true, en_insert=true, en_update=false, en_delete=false; limitado_a_properties=true
-- (la cláusula WHEN es exactamente bucket_id = 'properties'). Con eso la función NO se invoca para contract-documents.
-- Los EXECUTE de anon/authenticated son irrelevantes: una función RETURNS trigger no se puede llamar directamente.
-- Higiene (afecta solo a 'properties'): si security_definer=true, configuracion debe fijar search_path.
SELECT t.tgname, t.tgenabled AS habilitado, pg_get_triggerdef(t.oid) AS definicion_trigger,
 (t.tgtype & 1)<>0 AS por_fila, (t.tgtype & 2)<>0 AS antes,
 (t.tgtype & 4)<>0 AS en_insert, (t.tgtype & 16)<>0 AS en_update, (t.tgtype & 8)<>0 AS en_delete,
 pg_get_triggerdef(t.oid) ~* 'WHEN \(+new\.bucket_id = ''properties''::text\)+ EXECUTE' AS limitado_a_properties,
 p.oid::regprocedure AS funcion, n.nspname AS esquema_funcion, l.lanname AS lenguaje,
 pg_get_userbyid(p.proowner) AS propietario, p.prosecdef AS security_definer, p.proconfig AS configuracion, p.proacl AS acl,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute, has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,
 (SELECT count(*) FROM pg_trigger t2 WHERE t2.tgfoid=p.oid AND NOT t2.tgisinternal) AS triggers_que_la_usan,
 pg_get_functiondef(p.oid) AS definicion_completa
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
WHERE t.tgrelid='storage.objects'::regclass AND t.tgname='on_insert_storage_object';

-- P5. Qué hace la función (análisis automático del cuerpo; la definición de P4 manda en caso de duda).
-- Esperado para considerarla inocua para contract-documents:
--  campos_de_new_asignados como mucho {owner,owner_id} (sin bucket_id, name, metadata, version, id, path_tokens);
--  reemplaza_new_completo, escribe_en_tablas, sql_dinamico, puede_cancelar_insert, menciona_contract_documents = false.
--  usa_identidad_de_sesion=true es lo normal (owner = auth.uid()). puede_lanzar_error=true solo afectaría a 'properties'.
SELECT p.oid::regprocedure AS funcion,
 (SELECT array_agg(DISTINCT lower(m[2]) ORDER BY lower(m[2]))
  FROM regexp_matches(p.prosrc,'(^|[;\n]|\mthen|\melse|\mbegin|\mloop)\s*new\s*\.\s*([a-z_]+)\s*:?=','gi') m) AS campos_de_new_asignados,
 p.prosrc ~* '(^|[;\n])\s*new\s*:=' AS reemplaza_new_completo,
 p.prosrc ~* '\m(insert\s+into|update\s+[a-z_."]+\s+set|delete\s+from|merge\s+into|truncate)\M' AS escribe_en_tablas,
 p.prosrc ~* '\mexecute\M' AS sql_dinamico,
 p.prosrc ~* '\mperform\M' AS llama_otras_funciones,
 p.prosrc ~* 'return\s+null' AS puede_cancelar_insert,
 p.prosrc ~* '\mraise\M' AS puede_lanzar_error,
 p.prosrc ~* 'contract-documents' AS menciona_contract_documents,
 p.prosrc ~* '(auth\s*\.\s*uid|request\.jwt|current_setting)' AS usa_identidad_de_sesion,
 p.prosrc ~* '(\mnet\s*\.|\mhttp|supabase_functions)' AS llamadas_externas
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='storage.objects'::regclass AND t.tgname='on_insert_storage_object';

-- P6. Todos los triggers de usuario del esquema storage (objects, buckets y demás) con el mismo análisis.
-- Esperado: en objects solo on_insert_storage_object (excluye_contract_documents=true), protect_objects_delete
-- (BEFORE DELETE; puede_lanzar_error=true: bloquea DELETE directo por SQL, no la API de Storage) y
-- update_objects_updated_at (BEFORE UPDATE; asigna solo {updated_at}). Cualquier otro trigger con
-- excluye_contract_documents=false que asigne name/bucket_id/metadata, escriba en tablas o cancele la fila: revisar.
SELECT c.relname AS tabla, t.tgname, t.tgenabled AS habilitado,
 CASE WHEN (t.tgtype & 2)<>0 THEN 'BEFORE' WHEN (t.tgtype & 64)<>0 THEN 'INSTEAD OF' ELSE 'AFTER' END AS momento,
 concat_ws(',',CASE WHEN (t.tgtype & 4)<>0 THEN 'INSERT' END,CASE WHEN (t.tgtype & 16)<>0 THEN 'UPDATE' END,
  CASE WHEN (t.tgtype & 8)<>0 THEN 'DELETE' END,CASE WHEN (t.tgtype & 32)<>0 THEN 'TRUNCATE' END) AS eventos,
 p.oid::regprocedure AS funcion, pg_get_userbyid(p.proowner) AS propietario_funcion, p.prosecdef AS security_definer,
 (pg_get_triggerdef(t.oid) ~* 'WHEN \(+new\.bucket_id = ''[^'']+''::text\)+ EXECUTE'
  AND pg_get_triggerdef(t.oid) !~* 'contract-documents') AS excluye_contract_documents,
 (SELECT array_agg(DISTINCT lower(m[2]) ORDER BY lower(m[2]))
  FROM regexp_matches(p.prosrc,'(^|[;\n]|\mthen|\melse|\mbegin|\mloop)\s*new\s*\.\s*([a-z_]+)\s*:?=','gi') m) AS campos_de_new_asignados,
 p.prosrc ~* '\m(insert\s+into|update\s+[a-z_."]+\s+set|delete\s+from|merge\s+into|truncate)\M' AS escribe_en_tablas,
 p.prosrc ~* '\mexecute\M' AS sql_dinamico,
 p.prosrc ~* 'return\s+null' AS puede_cancelar_fila,
 p.prosrc ~* '\mraise\M' AS puede_lanzar_error,
 pg_get_triggerdef(t.oid) AS definicion_trigger
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='storage' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname;

-- P7. Reglas sobre tablas de storage (reescriben INSERT/UPDATE/DELETE) y event triggers (se ejecutan durante el
-- DDL de 04). Esperado: 0 reglas; event triggers solo los estándar de Supabase (issue_graphql_placeholder,
-- issue_pg_cron_access, issue_pg_graphql_access, issue_pg_net_access, pgrst_ddl_watch, pgrst_drop_watch).
-- Cualquier otro event trigger: revisar su función antes de instalar 04.
SELECT 'regla' AS tipo, schemaname||'.'||tablename AS objeto, rulename AS nombre, definition AS definicion
FROM pg_rules WHERE schemaname='storage'
UNION ALL
SELECT 'event_trigger', evtevent, evtname, e.evtfoid::regprocedure::text||' habilitado='||e.evtenabled::text||' propietario='||pg_get_userbyid(e.evtowner)
FROM pg_event_trigger e
ORDER BY 1,3;

-- P8. Funciones fuera de storage que leen o escriben storage.objects/buckets o mencionan contract-documents
-- (código propio que podría mover, copiar o borrar PDF). Esperado: ninguna con escribe_en_storage=true que pueda
-- afectar a contract-documents; las RPC de 2C (tras instalar 04) solo leen.
SELECT p.oid::regprocedure AS funcion, pg_get_userbyid(p.proowner) AS propietario, p.prosecdef AS security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute, has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 p.prosrc ~* '(insert\s+into|update|delete\s+from|merge\s+into)\s+storage\s*\.' AS escribe_en_storage,
 p.prosrc ~* 'contract-documents' AS menciona_contract_documents
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN('pg_catalog','information_schema','storage','firma_privada') AND p.prokind IN('f','p')
 AND p.prosrc ~* '(storage\s*\.\s*(objects|buckets)|contract-documents)'
ORDER BY 1;
-- P9 (aparte, solo si la extensión pg_cron existe; si no, la consulta falla sin efectos):
--   SELECT jobid, schedule, active, command FROM cron.job WHERE command ~* '(storage|contract-documents)';
-- Esperado: 0 filas o tareas conocidas que no toquen contract-documents.

-- ================================================================ C. CONTROLES PERIÓDICOS (tras instalar 04)
-- Ejecutar tras cualquier cambio de políticas de Storage y, como mínimo, antes de cada completado masivo o
-- con la periodicidad que se acuerde (p. ej. semanal). Cualquier fila "esperado: 0" distinta de 0 es incidente.

-- C1. TODAS las políticas permisivas de escritura en storage.objects para roles cliente, para revisión manual.
-- Esperado: 0 filas, o solo políticas con filtro POSITIVO a otro bucket (bucket_id = 'otro'). Una política sin
-- filtro de bucket, con filtro negativo (<>, NOT IN) o que mencione contract-documents abre el bucket al navegador.
SELECT policyname, roles, cmd, qual, with_check,
 coalesce(qual,'')||coalesce(with_check,'') LIKE '%contract-documents%' AS menciona_bucket,
 coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%bucket_id%' AS sin_filtro_de_bucket
FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND permissive='PERMISSIVE'
 AND cmd IN('INSERT','UPDATE','DELETE','ALL') AND (roles && ARRAY['anon','authenticated','public']::name[])
ORDER BY policyname;

-- C2. Bucket. Esperado: public=false, file_size_limit=10485760, allowed_mime_types={application/pdf}.
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='contract-documents';

-- C3. Integridad de las evidencias registradas: el objeto sigue existiendo y es exactamente el registrado
-- (mismo id de fila, eTag, tamaño y tipo). Esperado: 0 filas. Detecta sustituciones o borrados hechos con la
-- clave de servicio o desde el panel, que ninguna política puede impedir.
SELECT e.id AS evidencia_id, e.proceso_firma_id, p.estado AS estado_proceso, (p.evidencia_firmada_id=e.id) AS es_la_firmada,
 CASE WHEN o.id IS NULL THEN 'AUSENTE'
  WHEN o.id IS DISTINCT FROM e.storage_object_id THEN 'OBJETO_DISTINTO'
  WHEN o.metadata->>'eTag' IS DISTINCT FROM e.storage_etag THEN 'CONTENIDO_DISTINTO'
  ELSE 'METADATOS_DISTINTOS' END AS problema
FROM public.evidencias_firma e JOIN public.procesos_firma p ON p.id=e.proceso_firma_id
LEFT JOIN storage.objects o ON o.bucket_id='contract-documents' AND o.name=e.storage_path
WHERE o.id IS NULL OR o.id IS DISTINCT FROM e.storage_object_id OR o.metadata->>'eTag' IS DISTINCT FROM e.storage_etag
 OR o.metadata->>'size' IS DISTINCT FROM e.size_bytes::text OR o.metadata->>'mimetype' IS DISTINCT FROM e.mime_type
ORDER BY es_la_firmada DESC, e.id;

-- C4. PDF origen de cada proceso: presente con el tamaño validado al iniciar. Esperado: 0 filas.
SELECT p.id AS proceso, p.estado, CASE WHEN o.id IS NULL THEN 'AUSENTE' ELSE 'TAMAÑO_O_TIPO_DISTINTO' END AS problema
FROM public.procesos_firma p
LEFT JOIN storage.objects o ON o.bucket_id='contract-documents' AND o.name=p.storage_path_origen
WHERE o.id IS NULL OR o.metadata->>'size' IS DISTINCT FROM p.size_bytes_origen::text OR o.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf';

-- C5. Objetos bajo la ruta de evidencias clasificados. EVIDENCIA y RESERVA_VIGENTE son normales;
-- HUERFANO_LIMPIABLE lo limpia la tarea del servidor; SIN_RESERVA es anomalía: revisar a mano, nunca borrar en automático.
SELECT CASE WHEN e.id IS NOT NULL THEN 'EVIDENCIA'
  WHEN r.id IS NULL THEN 'SIN_RESERVA'
  WHEN r.expira_at>=clock_timestamp()-interval '1 hour' THEN 'RESERVA_VIGENTE'
  ELSE 'HUERFANO_LIMPIABLE' END AS clase, count(*) AS objetos, min(o.created_at) AS mas_antiguo
FROM storage.objects o
LEFT JOIN public.evidencias_firma e ON e.storage_path=o.name
LEFT JOIN firma_privada.reservas_evidencia r ON r.storage_path=o.name
WHERE o.bucket_id='contract-documents' AND o.name LIKE '%/firmas/%'
GROUP BY 1 ORDER BY 1;

-- C6. Reservas vencidas aún sin limpiar (la tarea de limpieza no está corriendo si crece). Esperado: pocas y recientes.
SELECT count(*) AS reservas_vencidas_sin_limpiar, min(expira_at) AS la_mas_antigua
FROM firma_privada.reservas_evidencia
WHERE consumida_at IS NULL AND limpiada_at IS NULL AND expira_at<clock_timestamp()-interval '1 hour';
