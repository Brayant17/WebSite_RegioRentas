import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
// Solo inspección estática: prohibido ejecutar SQL en esta etapa de revisión.
const sql=readFileSync('docs/sql/firmas-2c/01_infraestructura.sql','utf8');
const body=name=>sql.match(new RegExp('CREATE FUNCTION '+name.replaceAll('.','\\.')+'\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;'))?.[1];
test('2C: migración transaccional, instalación nueva y sin SQL de Storage ni reemplazos',()=>{
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;\s*$/);assert.match(sql,/Falta columna requerida/);
 assert.equal((sql.match(/CREATE TABLE public\./g)||[]).length,3);
 assert.doesNotMatch(sql,/DROP\s+(TABLE|SCHEMA)|CREATE OR REPLACE|UPDATE\s+storage\.|DELETE FROM\s+storage\./i);
});
test('2C: proceso único pendiente, relación por parte y protección de hashes',()=>{
 assert.match(sql,/UNIQUE INDEX procesos_firma_un_pendiente[^;]+WHERE estado='PENDIENTE'/);
 assert.match(sql,/UNIQUE\(proceso_firma_id,parte_contrato_id,persona_firmante_id\)/);
 assert.match(sql,/sha256_documento_origen ~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(sql,/REFERENCES public\.partes_contrato\(id\) ON DELETE RESTRICT/);
});
test('2C: auth/admin y recibo servidor obligatorio ligado a actor, documento, fuentes y hash',()=>{
 assert.match(body('firma_privada.admin_actual'),/auth.uid\(\)/);assert.match(body('firma_privada.admin_actual'),/role='admin'/);
 const start=body('public.iniciar_proceso_firma');assert.ok(start);
 for(const guard of ['v.actor_id IS DISTINCT FROM actor','v.sha256 IS DISTINCT FROM p_sha256','v.documento_id IS DISTINCT FROM p_documento','v.usado_por IS NOT NULL','v.expires_at<=clock_timestamp()','v.documento IS DISTINCT FROM to_jsonb(d)','v.fuentes IS DISTINCT FROM firma_privada.fuentes(p_contrato)'])assert.ok(start.includes(guard),guard);
 assert.match(start,/WHERE id=p_contrato FOR UPDATE/);assert.match(start,/id=p_documento AND contrato_id=p_contrato FOR UPDATE/);
 assert.match(start,/estado IS DISTINCT FROM 'BORRADOR'/);assert.match(start,/Documento sin PDF\/snapshot\/HTML/);
 assert.match(body('public.registrar_validacion_documento_firma'),/d.datos_snapshot IS DISTINCT FROM p_contexto_actual/);
});
test('2C: no elegir última revisión; representante congelado y roles sin cobertura rechazados',()=>{
 const start=body('public.iniciar_proceso_firma');assert.doesNotMatch(start,/max\(|ORDER BY.*numero_version/i);
 assert.match(start,/representative.persona_id/);assert.match(start,/representative.caracter/);
 assert.match(start,/'representante',to_jsonb\(representative\)/);assert.match(start,/roles sin cobertura aprobada/);
 assert.match(start,/UPDATE public.documentos_contrato SET tipo='PARA_FIRMA'/);
 assert.match(start,/UPDATE public.contratos SET estado='PENDIENTE_FIRMA'/);
});
test('2C: cancelación preserva evidencia y documento, requiere motivo y cambia solo proceso/contrato',()=>{
 const cancel=body('public.cancelar_proceso_firma');assert.match(cancel,/Motivo obligatorio/);assert.match(cancel,/FOR UPDATE/);
 assert.match(cancel,/cancelado_por=actor/);assert.match(cancel,/estado='BORRADOR'/);
 assert.doesNotMatch(cancel,/UPDATE public.documentos_contrato|DELETE FROM|UPDATE public.firmantes_proceso/);
 assert.match(cancel,/Proceso con firmas\/evidencias/);
});
test('2C: RLS, grants restringidos, auxiliares privadas y SECURITY DEFINER sin search_path público',()=>{
 for(const table of ['procesos_firma','firmantes_proceso','evidencias_firma'])assert.match(sql,new RegExp('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY'));
 assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE|ALL) ON public\.(procesos_firma|firmantes_proceso|evidencias_firma)/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public.firma_fuentes_para_verificar[^;]+TO service_role;/);
 assert.match(sql,/REVOKE ALL ON ALL FUNCTIONS IN SCHEMA firma_privada/);
 for(const def of sql.matchAll(/CREATE FUNCTION[\s\S]*?AS \$\$/g))if(def[0].includes('SECURITY DEFINER'))assert.ok(def[0].includes("SET search_path=''"));
});
test('2C: triggers protegen documentos y partes, invariantes diferidas, no flags de sesión',()=>{
 assert.match(body('firma_privada.proteger_contrato'),/Condiciones congeladas fuera de BORRADOR/);
 assert.match(body('firma_privada.proteger_parte'),/FOR UPDATE/);
 assert.match(body('firma_privada.proteger_documento'),/Documento origen inmutable/);
 assert.match(sql,/DEFERRABLE INITIALLY DEFERRED/);assert.doesNotMatch(sql,/set_config\(/);
 assert.match(body('firma_privada.proteger_evidencia'),/no habilitado en etapa 1/);
});
test('2C: consultas manuales son de lectura y documentación declara límites reales',()=>{
 const q=readFileSync('docs/sql/firmas-2c/00_verificaciones_solo_lectura.sql','utf8').replace(/--[^\n]*/g,'');
 assert.doesNotMatch(q,/\b(UPDATE|DELETE|INSERT|ALTER|CREATE|DROP|GRANT|REVOKE|CALL)\b/i);
 const doc=readFileSync('docs/firmas-2c-etapa1.md','utf8');assert.match(doc,/VERIFICACIONES REQUERIDAS EN SUPABASE/);assert.match(doc,/NO se implementa ahora/);assert.match(doc,/No se ejecutó esta matriz SQL/);
});
