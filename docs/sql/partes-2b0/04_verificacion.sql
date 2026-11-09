-- SOLO LECTURA, después de 01/02. Los primeros 7 grupos deben quedar sin inconsistencias.
SELECT c.id,c.folio,count(p.id) AS arrendadores FROM public.contratos c
LEFT JOIN public.partes_contrato p ON p.contrato_id=c.id AND p.rol='ARRENDADOR'
GROUP BY c.id,c.folio HAVING count(p.id)=0;
SELECT contrato_id,count(*) FROM public.partes_contrato WHERE rol='ARRENDADOR' GROUP BY contrato_id HAVING count(*)>1;
SELECT * FROM public.partes_contrato WHERE persona_id IS NOT NULL AND persona_moral_id IS NOT NULL;
SELECT * FROM public.partes_contrato WHERE persona_id IS NULL AND persona_moral_id IS NULL;
SELECT * FROM public.partes_contrato WHERE persona_moral_id IS NOT NULL AND rol<>'ARRENDADOR';
SELECT c.id,c.folio,c.arrendador_persona_moral_id,p.persona_id,p.persona_moral_id FROM public.contratos c
JOIN public.partes_contrato p ON p.contrato_id=c.id AND p.rol='ARRENDADOR'
WHERE c.arrendador_persona_moral_id IS DISTINCT FROM p.persona_moral_id;
SELECT contrato_id,persona_id,persona_moral_id,rol,count(*) FROM public.partes_contrato
GROUP BY contrato_id,persona_id,persona_moral_id,rol HAVING count(*)>1;
-- Revisar el contrato actual por folio (ajustar solo el literal si corresponde).
SELECT c.folio,p.id,p.rol,p.persona_id,p.persona_moral_id,pm.razon_social,pe.nombre,pe.apellido_paterno
FROM public.contratos c JOIN public.partes_contrato p ON p.contrato_id=c.id
LEFT JOIN public.personas_morales pm ON pm.id=p.persona_moral_id LEFT JOIN public.personas pe ON pe.id=p.persona_id
WHERE c.folio='CTR-2026-000001' ORDER BY p.rol;
SELECT pm.id,pm.razon_social,count(r.id) AS principales FROM public.personas_morales pm
LEFT JOIN public.representantes_persona_moral r ON r.persona_moral_id=pm.id AND r.es_principal=true
WHERE pm.id IN(SELECT persona_moral_id FROM public.partes_contrato WHERE rol='ARRENDADOR')
GROUP BY pm.id,pm.razon_social;
SELECT r.persona_moral_id,r.caracter,r.es_principal,p.id,p.nombre,p.apellido_paterno,p.apellido_materno
FROM public.representantes_persona_moral r JOIN public.personas p ON p.id=r.persona_id WHERE r.es_principal=true;
SELECT 'contratos' AS tabla,count(*) FROM public.contratos
UNION ALL SELECT 'partes_contrato',count(*) FROM public.partes_contrato
UNION ALL SELECT 'documentos_contrato',count(*) FROM public.documentos_contrato;
SELECT rol,count(*) FROM public.partes_contrato GROUP BY rol;
SELECT p.oid::regprocedure,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN('crear_contrato_desde_solicitud','cambiar_arrendador_contrato_borrador');
SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN('contratos','partes_contrato') ORDER BY table_name,grantee;
