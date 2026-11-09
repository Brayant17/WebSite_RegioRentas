import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
// Etapa 2 de 2C (firma autógrafa, anulación y protección de Storage) en PostgreSQL local en memoria (PGlite).
// Jamás contra Supabase.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const STAGE1 = read('../docs/sql/firmas-2c/02_infraestructura_corregida.sql');
const STAGE2 = read('../docs/sql/firmas-2c/04_etapa2_firma_autografa.sql');
const CHECKS = read('../docs/sql/firmas-2c/05_etapa2_verificaciones_solo_lectura.sql');
const STORAGE_CONTROLS = read('../docs/sql/firmas-2c/06_etapa2_storage_controles_solo_lectura.sql');
const DESIGN = read('../docs/firmas-2c-etapa2-diseno.md');
// Una consulta concreta de un archivo de controles (desde '-- C3.' hasta la siguiente cabecera).
function section(sql, id) {
 const start = sql.indexOf(`-- ${id}.`);
 assert.ok(start >= 0, id);
 const rest = sql.slice(start);
 const end = rest.slice(1).search(/\n-- (?:[PC]\d+\.|=)/);
 return (end < 0 ? rest : rest.slice(0, end + 1)).trim().replace(/;$/, '');
}
const DECL = 'PDF_FIRMADO_CORRESPONDE_V1';
const ids = {
 admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', admin2: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 rep: '11111111-1111-4111-8111-111111111111', company: '22222222-2222-4222-8222-222222222222', tenant: '33333333-3333-4333-8333-333333333333',
 guarantor: '44444444-4444-4444-8444-444444444444', template: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', v2: 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2',
};
const HTML_V2 = '<p>{{arrendador.bloques.firma}} {{arrendatario.nombre_completo}} {{fiador.nombre_completo}}</p>';
const COVERAGE = [{ rol: 'ARRENDADOR', minimo: 1, maximo: 1, entidades: ['PERSONA_MORAL'] }, { rol: 'ARRENDATARIO', minimo: 1, maximo: 1, entidades: ['PERSONA'] }, { rol: 'FIADOR', minimo: 0, maximo: 1, entidades: ['PERSONA'] }];
const ENUMS = `
CREATE TYPE public.estado_contrato AS ENUM('BORRADOR','PENDIENTE_FIRMA','FIRMADO','ACTIVO','FINALIZADO','CANCELADO','TERMINADO_ANTICIPADAMENTE');
CREATE TYPE public.tipo_documento AS ENUM('BORRADOR','PARA_FIRMA','FIRMADO');
CREATE TYPE public.estado_documento AS ENUM('GENERADO','ENVIADO','REEMPLAZADO','ANULADO');
ALTER TABLE public.contratos ALTER COLUMN estado DROP DEFAULT, ALTER COLUMN estado TYPE public.estado_contrato USING estado::public.estado_contrato, ALTER COLUMN estado SET DEFAULT 'BORRADOR';
ALTER TABLE public.documentos_contrato ALTER COLUMN tipo TYPE public.tipo_documento USING tipo::public.tipo_documento, ALTER COLUMN estado TYPE public.estado_documento USING estado::public.estado_documento;`;
// Réplica mínima de Supabase Storage con los privilegios reales verificados (05 S3): storage.objects pertenece a
// otro rol (supabase_storage_admin), el instalador NO es miembro y solo lee; RLS activo y privilegios amplios a los
// roles cliente (Supabase delega en políticas). Sin ninguna política: denegación por defecto.
const STORAGE = `
CREATE ROLE storage_admin_sim NOLOGIN;
CREATE SCHEMA storage AUTHORIZATION storage_admin_sim;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets,name text,owner uuid,
 owner_id text,metadata jsonb,version text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),last_accessed_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
INSERT INTO storage.buckets VALUES('contract-documents','contract-documents',false,10485760,'{application/pdf}'),('avatars','avatars',true,NULL,NULL),('properties','properties',true,NULL,NULL);
ALTER TABLE storage.buckets OWNER TO storage_admin_sim; ALTER TABLE storage.objects OWNER TO storage_admin_sim;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO propietario_sim,anon,authenticated,service_role;
GRANT SELECT ON storage.buckets,storage.objects TO propietario_sim;
GRANT ALL ON storage.objects TO anon,authenticated,service_role;`;

async function baseDb({ enums }) {
 const db = new PGlite();
 await db.exec(read('./fixtures/partes-schema.sql').replaceAll('fixture_contract_folio_seq', 'contratos_folio_seq'));
 await db.exec(read('../docs/sql/partes-2b0/01_esquema.sql'));
 const hash = (await db.query("select md5(pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure)) h")).rows[0].h;
 await db.exec(read('../docs/sql/partes-2b0/02_rpc.sql').replace('c1e2e7ed4a9dd613bbbbe06f4dae50b7', hash));
 await db.exec(read('./fixtures/firmas-2c-schema.sql'));
 await db.exec(STORAGE);
 if (enums) await db.exec(ENUMS);
 return db;
}

test('05 y 06: verificaciones y controles de solo lectura', () => {
 // Los literales ('UPDATE' en has_table_privilege, cmd IN('INSERT',...)) no son sentencias.
 for (const sql of [CHECKS, STORAGE_CONTROLS]) {
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, "''"), /\b(UPDATE|DELETE|INSERT|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|TRUNCATE|LOCK|COMMENT|NOTIFY|SET|DO|BEGIN)\b|FOR (UPDATE|SHARE)/i);
 }
});

function suite(label, { enums }) {
 describe(`2C etapa 2 (${label})`, () => {
  let db, legacy;
  const rows = async (text, params = []) => (await db.query(text, params)).rows;
  async function as(role, fn, sub) {
   if (sub !== undefined) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
   await db.exec(`set role ${role}`);
   try { return await fn(); } finally { await db.exec('reset role').catch(() => {}); }
  }
  const admin = (fn, sub = ids.admin) => as('authenticated', fn, sub);
  const service = fn => as('service_role', fn);
  const owner = fn => as('propietario_sim', fn);
  const abort = async () => { await db.exec('ROLLBACK'); await db.exec('reset role'); };
  // Cambios fuera de banda (administrador de Supabase, acceso directo al almacenamiento): sin triggers ni RLS.
  async function bypass(text, params = []) {
   await db.exec('SET session_replication_role=replica');
   try { return await db.query(text, params); } finally { await db.exec('SET session_replication_role=origin'); }
  }
  const fingerprint = async () => (await rows("select md5(replace(prosrc,E'\\r','')) h from pg_proc where oid='firma_privada.proteger_evidencia()'::regprocedure"))[0].h;

  before(async () => {
   db = await baseDb({ enums });
   await owner(() => db.exec(STAGE1));
   await db.query("insert into versiones_plantilla values($1,$2,2,'BORRADOR',$3)", [ids.v2, ids.template, HTML_V2]);
   await owner(() => db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,$3::jsonb,'Aprobación jurídica de prueba')", [ids.v2, sha(HTML_V2), JSON.stringify(COVERAGE)]));
   // Un proceso PENDIENTE creado con la etapa 1 debe sobrevivir a la instalación de la etapa 2.
   legacy = await pending();
   // El preflight rechaza una etapa 1 modificada (huella distinta) o CHECK de estado distintos, sin dejar cambios.
   await db.exec('BEGIN');
   await owner(() => db.exec("CREATE OR REPLACE FUNCTION firma_privada.proteger_evidencia() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RETURN NEW; END $$"));
   await assert.rejects(owner(() => db.exec(STAGE2)), /proteger_evidencia\(\) no coincide con la etapa 1/);
   await abort();
   await db.exec('BEGIN');
   await owner(() => db.exec("ALTER TABLE public.procesos_firma ADD CONSTRAINT extra CHECK(estado<>'CANCELADO' OR motivo_cancelacion IS NOT NULL)"));
   await assert.rejects(owner(() => db.exec(STAGE2)), /CHECK de estado de procesos_firma no son los de la etapa 1/);
   await abort();
   // Sin lectura de storage.objects: aborta sin cambios.
   await db.exec('BEGIN; REVOKE SELECT ON storage.objects FROM propietario_sim;');
   await assert.rejects(owner(() => db.exec(STAGE2)), /no puede leer storage.objects/);
   await abort();
   await owner(() => db.exec(STAGE2));
  });
  after(async () => db.close());

  // ---------------------------------------------------------------- datos y "servidor" simulados
  async function contract({ guarantor = true } = {}) {
   const app = randomUUID();
   await db.query("insert into solicitudes values($1,1,'aprobada')", [app]);
   await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'solicitante')", [app, ids.tenant]);
   if (guarantor) await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'fiador')", [app, ids.guarantor]);
   return (await admin(() => rows("select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,12000::numeric,12000::numeric,1::integer,'PERSONA_MORAL'::text,$2::uuid) id", [app, ids.company])))[0].id;
  }
  const text = value => { const t = value == null ? '' : String(value).trim().replace(/\s+/g, ' '); return /^(null|undefined)$/i.test(t) ? '' : t; };
  const fullName = p => (p ? [p.nombre, p.apellido_paterno, p.apellido_materno].map(text).filter(Boolean).join(' ') : '');
  const personContext = p => ({ nombre_completo: fullName(p), rfc: text(p?.rfc), curp: text(p?.curp) });
  const person = async id => (await rows('select * from personas where id=$1', [id]))[0];
  const parts = contractId => rows('select id,rol::text rol,persona_id,persona_moral_id from partes_contrato where contrato_id=$1 order by id', [contractId]);
  const principal = async company => (await rows('select * from representantes_persona_moral where persona_moral_id=$1 and es_principal order by id', [company]))[0];
  async function snapshotFor(contractId) {
   const list = await parts(contractId);
   const company = (await rows('select * from personas_morales where id=$1', [ids.company]))[0];
   const rep = await principal(ids.company);
   const one = async role => { const part = list.find(p => p.rol === role); return personContext(part ? await person(part.persona_id) : null); };
   return { arrendador: { tipo: 'PERSONA_MORAL', razon_social: text(company.razon_social), representante: personContext(await person(rep.persona_id)) },
    arrendatario: await one('ARRENDATARIO'), fiador: await one('FIADOR') };
  }
  async function identitiesFor(contractId) {
   const result = [];
   for (const part of await parts(contractId)) {
    const base = { parte_contrato_id: part.id, rol: part.rol, referencia_documento: part.rol.toLowerCase() };
    if (part.persona_moral_id) { const rep = await principal(part.persona_moral_id); result.push({ ...base, entidad_tipo: 'PERSONA_MORAL', entidad_id: part.persona_moral_id, persona_firmante_id: rep.persona_id, representante_origen_id: rep.id }); }
    else result.push({ ...base, entidad_tipo: 'PERSONA', entidad_id: part.persona_id, persona_firmante_id: part.persona_id, representante_origen_id: null });
   }
   return result;
  }
  // Inicia un proceso sobre un contrato BORRADOR: genera una revisión nueva del documento salvo que se indique otra.
  async function start(contractId, { documentId, pdfSha } = {}) {
   const context = await snapshotFor(contractId);
   const html = `<p>${context.arrendatario.nombre_completo}</p>`;
   if (!documentId) {
    const n = (await rows('select coalesce(max(numero_version),0)+1 n from documentos_contrato where contrato_id=$1', [contractId]))[0].n;
    documentId = (await admin(() => rows(`insert into documentos_contrato(contrato_id,version_plantilla_id,numero_version,tipo,estado,nombre_archivo,datos_snapshot,contenido_renderizado,generated_at)
     values($1,$2,$5::integer,'BORRADOR','GENERADO',$6,$3::jsonb,$4,now()) returning id`, [contractId, ids.v2, JSON.stringify(context), html, n, `CTR-prueba-v${n}.pdf`])))[0].id;
    await service(() => db.query("update documentos_contrato set storage_path=contrato_id::text||'/'||id::text||'/'||nombre_archivo where id=$1", [documentId]));
   }
   const fuentes = (await service(() => rows('select firma_fuentes_para_verificar($1) f', [contractId])))[0].f;
   pdfSha ??= sha('%PDF-origen-' + documentId);
   const identities = await identitiesFor(contractId);
   const receipt = (await service(() => rows('select registrar_validacion_documento_firma($1,$2,$3,$4,2048,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb) id',
    [ids.admin, contractId, documentId, pdfSha, JSON.stringify(fuentes), JSON.stringify(context), sha(html), sha(HTML_V2), 'renderer-prueba', JSON.stringify(identities)])))[0].id;
   const processId = (await admin(() => rows('select iniciar_proceso_firma($1,$2,$3,$4) id', [contractId, documentId, pdfSha, receipt])))[0].id;
   const signers = await rows('select id,rol from firmantes_proceso where proceso_firma_id=$1 order by rol', [processId]);
   return { contractId, documentId, processId, pdfSha, signers };
  }
  const pending = async options => start(await contract(options));
  // Fecha declarada por defecto: clock_timestamp() del propio SELECT (entre el inicio del proceso y el registro).
  const sign = (p, signerId, { origin = p.pdfSha, check = 'INE', at, sub = ids.admin } = {}) =>
   admin(() => at === undefined
    ? db.query('select registrar_firma_firmante($1,$2,$3,$4,clock_timestamp())', [p.processId, signerId, origin, check])
    : db.query('select registrar_firma_firmante($1,$2,$3,$4,$5)', [p.processId, signerId, origin, check, at]), sub);
  const signAll = async p => { for (const s of p.signers) await sign(p, s.id); };
  // Servidor simulado: reserva -> sube el objeto (service_role, como la API de Storage) -> registra.
  const reserve = (p, { actor = ids.admin } = {}) => service(() => rows('select * from reservar_evidencia_firma($1,$2)', [actor, p.processId])).then(r => r[0]);
  const put = (path, { bytes = 4096, mime = 'application/pdf', etag = randomUUID(), createdAt = null } = {}) =>
   service(() => db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('contract-documents',$1,$2::jsonb,coalesce($3::timestamptz,now())) on conflict do nothing",
    [path, JSON.stringify({ size: bytes, mimetype: mime, eTag: `"${etag}"` }), createdAt]));
  const register = (p, id, { hash, bytes = 4096, mime = 'application/pdf', actor = ids.admin, version = DECL, confirm = true } = {}) =>
   service(() => rows('select registrar_evidencia_firma($1,$2,$3,$4,$5,$6,$7,$8) id', [actor, p.processId, id, hash, bytes, mime, version, confirm])).then(r => r[0].id);
  async function evidence(p, { content = 'firmado-' + randomUUID(), bytes = 4096, upload = true, actor = ids.admin } = {}) {
   const r = await reserve(p, { actor });
   const hash = content.length === 64 ? content : sha(content);
   if (upload) await put(r.ruta_storage, { bytes });
   const id = await register(p, r.evidencia_id, { hash, bytes, actor });
   return { id, sha: hash, path: r.ruta_storage, bytes };
  }
  const complete = (p, ev, { sub = ids.admin, hash = ev.sha } = {}) => admin(() => db.query('select completar_proceso_firma($1,$2,$3)', [p.processId, ev.id, hash]), sub);
  const annul = (p, { reason = 'El fiador se negó a firmar el contrato', dest = 'BORRADOR', sub = ids.admin } = {}) =>
   admin(() => db.query('select anular_proceso_firma($1,$2,$3)', [p.processId, reason, dest]), sub);
  const cancel = (p, reason = 'Datos erróneos') => admin(() => db.query('select cancelar_proceso_firma($1,$2)', [p.processId, reason]));
  const expire = id => bypass("update firma_privada.reservas_evidencia set reservado_at=reservado_at-interval '3 hours',expira_at=expira_at-interval '3 hours' where id=$1", [id]);
  const contractState = async id => (await rows('select estado::text e from contratos where id=$1', [id]))[0].e;
  const processRow = async id => (await rows('select * from procesos_firma where id=$1', [id]))[0];
  const signerStates = async id => (await rows('select estado from firmantes_proceso where proceso_firma_id=$1 order by rol', [id])).map(r => r.estado);
  const evidenceCount = async id => (await rows('select count(*)::int n from evidencias_firma where proceso_firma_id=$1', [id]))[0].n;
  const history = async p => ({
   signers: await rows('select * from firmantes_proceso where proceso_firma_id=$1 order by id', [p.processId]),
   evidences: await rows('select * from evidencias_firma where proceso_firma_id=$1 order by id', [p.processId]),
   document: (await rows('select * from documentos_contrato where id=$1', [p.documentId]))[0],
  });
  const reservation = async id => (await bypass('select * from firma_privada.reservas_evidencia where id=$1', [id])).rows[0];

  // ---------------------------------------------------------------- instalación y privilegios
  test('instala sobre la etapa 1 conservando procesos previos y rechaza reinstalar', async () => {
   assert.equal((await processRow(legacy.processId)).estado, 'PENDIENTE');
   assert.deepEqual(await signerStates(legacy.processId), ['PENDIENTE', 'PENDIENTE', 'PENDIENTE']);
   assert.notEqual(await fingerprint(), 'b09124d8bed47a44e784473b1f8bc7d3');
   await assert.rejects(owner(() => db.exec(STAGE2)), /ya está instalada|no coincide con la etapa 1/); await abort();
   // El proceso heredado sigue su ciclo con la etapa 2.
   await signAll(legacy); await complete(legacy, await evidence(legacy));
   assert.equal(await contractState(legacy.contractId), 'FIRMADO');
  });

  test('04 instala con los privilegios reales: sin escribir, bloquear ni crear nada en el esquema storage', async () => {
   const r = (await rows(`select pg_has_role('propietario_sim','storage_admin_sim','MEMBER') miembro,
    has_table_privilege('propietario_sim','storage.objects','UPDATE,INSERT,DELETE,TRIGGER') escritura,
    (select count(*)::int from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal) triggers,
    (select count(*)::int from pg_policies where schemaname='storage') politicas`))[0];
   assert.deepEqual(r, { miembro: false, escritura: false, triggers: 0, politicas: 0 });
   assert.doesNotMatch(STAGE2.replace(/--[^\n]*/g, ''), /(CREATE|ALTER|DROP)\s+(POLICY|TRIGGER)[^;]*storage\.|ON storage\.|FOR (SHARE|UPDATE) OF o/i);
  });

  test('P4-P6: on_insert_storage_object (WHEN properties) se clasifica como inocuo y no actúa sobre contract-documents', async () => {
   // Réplica del trigger real (definición informada desde Supabase); el cuerpo es el típico "owner = auth.uid()".
   await db.exec(`CREATE FUNCTION public.set_storage_object_owner() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
     IF NEW.bucket_id = 'properties' THEN
      NEW.owner_id := auth.uid()::text;
     END IF;
     RETURN NEW;
    END $$;
    CREATE TRIGGER on_insert_storage_object BEFORE INSERT ON storage.objects FOR EACH ROW
     WHEN (new.bucket_id = 'properties') EXECUTE FUNCTION public.set_storage_object_owner();`);
   try {
    const p4 = (await owner(() => rows(section(STORAGE_CONTROLS, 'P4'))))[0];
    assert.deepEqual([p4.habilitado, p4.antes, p4.en_insert, p4.en_update, p4.en_delete, p4.limitado_a_properties, Number(p4.triggers_que_la_usan)],
     ['O', true, true, false, false, true, 1]);
    assert.match(p4.definicion_completa, /owner_id := auth\.uid\(\)/);
    const p5 = (await owner(() => rows(section(STORAGE_CONTROLS, 'P5'))))[0];
    assert.deepEqual({ ...p5, funcion: undefined }, { funcion: undefined, campos_de_new_asignados: ['owner_id'], reemplaza_new_completo: false,
     escribe_en_tablas: false, sql_dinamico: false, llama_otras_funciones: false, puede_cancelar_insert: false, puede_lanzar_error: false,
     menciona_contract_documents: false, usa_identidad_de_sesion: true, llamadas_externas: false });
    const p6 = (await owner(() => rows(section(STORAGE_CONTROLS, 'P6')))).find(r => r.tgname === 'on_insert_storage_object');
    assert.deepEqual([p6.momento, p6.eventos, p6.excluye_contract_documents], ['BEFORE', 'INSERT', true]);
    // Comportamiento: en 'properties' fija owner_id; en contract-documents no se ejecuta y la evidencia se registra igual.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.admin]);
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('properties',$1,'{}')", [randomUUID()]);
    assert.equal((await rows("select owner_id from storage.objects where bucket_id='properties' order by created_at desc limit 1"))[0].owner_id, ids.admin);
    const p = await pending(); const ev = await evidence(p);
    const stored = (await rows('select owner_id,metadata from storage.objects where name=$1', [ev.path]))[0];
    assert.equal(stored.owner_id, null);
    assert.equal((await rows('select storage_etag from evidencias_firma where id=$1', [ev.id]))[0].storage_etag, stored.metadata.eTag);
    // Un trigger que sí tocara contract-documents queda marcado.
    await db.exec(`CREATE FUNCTION public.mover_sim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.name := 'x/' || NEW.name; RETURN NEW; END $$;
     CREATE TRIGGER mover_sim BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.mover_sim();`);
    const bad = (await owner(() => rows(section(STORAGE_CONTROLS, 'P6')))).find(r => r.tgname === 'mover_sim');
    assert.deepEqual([bad.eventos, bad.excluye_contract_documents, bad.campos_de_new_asignados], ['INSERT,UPDATE', false, ['name']]);
   } finally {
    await db.exec(`DROP TRIGGER IF EXISTS mover_sim ON storage.objects; DROP FUNCTION IF EXISTS public.mover_sim();
     DROP TRIGGER on_insert_storage_object ON storage.objects; DROP FUNCTION public.set_storage_object_owner();`);
   }
  });

  test('05 y 06: las verificaciones y controles de solo lectura se ejecutan sobre el esquema instalado', async () => {
   await owner(() => db.exec(CHECKS));
   await owner(() => db.exec(STORAGE_CONTROLS));
  });

  test('EXECUTE: cada RPC solo para su rol; auxiliares privadas sin EXECUTE para clientes', async () => {
   const can = async (role, fn) => (await rows('select has_function_privilege($1,$2,\'EXECUTE\') ok', [role, fn]))[0].ok;
   const forAuthenticated = ['public.registrar_firma_firmante(uuid,uuid,text,text,timestamptz)', 'public.completar_proceso_firma(uuid,uuid,text)', 'public.anular_proceso_firma(uuid,text,text)'];
   const forService = ['public.reservar_evidencia_firma(uuid,uuid)', 'public.registrar_evidencia_firma(uuid,uuid,uuid,text,bigint,text,text,boolean)',
    'public.listar_reservas_evidencia_vencidas(integer)', 'public.marcar_reserva_evidencia_limpiada(uuid)'];
   const privateFns = ['firma_privada.objeto_pdf(text,bigint)', 'firma_privada.ruta_evidencia(uuid,uuid,uuid)', 'firma_privada.declaracion_evidencia(text,text)',
    'firma_privada.proteger_reserva()'];
   for (const fn of forAuthenticated) assert.deepEqual([await can('authenticated', fn), await can('service_role', fn), await can('anon', fn)], [true, false, false], fn);
   for (const fn of forService) assert.deepEqual([await can('authenticated', fn), await can('service_role', fn), await can('anon', fn)], [false, true, false], fn);
   for (const fn of privateFns) for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await can(role, fn), false, `${role} ${fn}`);
  });

  test('las RPC nuevas no abren escritura: sin DML de clientes, search_path vacío y sin SQL dinámico', async () => {
   const write = 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER';
   for (const table of ['public.procesos_firma', 'public.firmantes_proceso', 'public.evidencias_firma', 'firma_privada.reservas_evidencia']) {
    for (const role of ['anon', 'authenticated', 'service_role']) {
     assert.equal((await rows(`select has_table_privilege($1,$2,'${write}') w`, [role, table]))[0].w, false, `${role} ${table}`);
    }
   }
   for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await rows("select has_table_privilege($1,'firma_privada.reservas_evidencia','SELECT') r", [role]))[0].r, false, role);
   }
   const definers = await rows(`select p.oid::regprocedure::text fn,p.proconfig,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.prosecdef and (n.nspname='firma_privada' or p.proname in('registrar_firma_firmante','reservar_evidencia_firma','registrar_evidencia_firma',
     'completar_proceso_firma','anular_proceso_firma','listar_reservas_evidencia_vencidas','marcar_reserva_evidencia_limpiada'))`);
   assert.ok(definers.length >= 9);
   for (const f of definers) {
    assert.ok((f.proconfig ?? []).some(c => /^search_path=(""|)$/.test(c)), `${f.fn} sin search_path vacío`);
    if (!f.fn.startsWith('firma_privada.registrar_cobertura')) assert.doesNotMatch(f.prosrc, /\bEXECUTE\b/i, f.fn);
   }
  });

  // ---------------------------------------------------------------- caso válido
  test('flujo completo: firmas, reserva, evidencia con declaración y completado; contrato FIRMADO con auditoría', async () => {
   const p = await pending();
   const before = (await rows('select tipo::text tipo,estado::text estado from documentos_contrato where id=$1', [p.documentId]))[0];
   await signAll(p);
   const signers = await rows('select estado,registrado_por,registrado_at,firmado_at,verificacion_identidad from firmantes_proceso where proceso_firma_id=$1', [p.processId]);
   for (const s of signers) { assert.equal(s.estado, 'FIRMADO'); assert.equal(s.registrado_por, ids.admin); assert.equal(s.verificacion_identidad, 'INE'); assert.ok(s.firmado_at <= s.registrado_at); }
   const ev = await evidence(p);
   // Reintento del endpoint tras perder la respuesta: mismo id y mismos datos = idempotente.
   assert.equal(await register(p, ev.id, { hash: ev.sha }), ev.id);
   assert.equal(await evidenceCount(p.processId), 1);
   const stored = (await rows('select * from evidencias_firma where id=$1', [ev.id]))[0];
   const object = (await rows('select id,metadata from storage.objects where name=$1', [ev.path]))[0];
   assert.deepEqual({ by: stored.uploaded_by, path: stored.storage_path, mime: stored.mime_type, size: Number(stored.size_bytes), version: stored.declaracion_version, obj: stored.storage_object_id, etag: stored.storage_etag },
    { by: ids.admin, path: ev.path, mime: 'application/pdf', size: 4096, version: DECL, obj: object.id, etag: object.metadata.eTag });
   assert.match(stored.declaracion_texto, new RegExp(`^Declaro que el archivo PDF registrado corresponde al documento origen .*${p.pdfSha}`));
   assert.ok((await reservation(ev.id)).consumida_at);
   await complete(p, ev, { sub: ids.admin2 });
   const process = await processRow(p.processId);
   assert.equal(process.estado, 'COMPLETADO'); assert.equal(process.completado_por, ids.admin2); assert.ok(process.completado_at);
   assert.equal(process.evidencia_firmada_id, ev.id); assert.equal(process.sha256_documento_firmado, ev.sha); assert.equal(process.sha256_documento_origen, p.pdfSha);
   assert.deepEqual([process.anulado_at, process.anulado_por, process.motivo_anulacion, process.destino_contrato_anulacion], [null, null, null, null]);
   assert.equal(await contractState(p.contractId), 'FIRMADO');
   assert.deepEqual((await rows('select tipo::text tipo,estado::text estado from documentos_contrato where id=$1', [p.documentId]))[0], before);
   // Tras completar: ni completar otra vez, ni reservar, ni cancelar, ni anular.
   await assert.rejects(complete(p, ev), /no pendiente/);
   await assert.rejects(reserve(p), /no pendiente/);
   await assert.rejects(cancel(p, 'tarde'), /no pendiente/);
   await assert.rejects(annul(p), /no pendiente/);
   // El contrato firmado sigue su ciclo normal y no vuelve atrás.
   await assert.rejects(owner(() => db.query("update contratos set estado='BORRADOR' where id=$1", [p.contractId])), /no permitida/);
   await owner(() => db.query("update contratos set estado='ACTIVO' where id=$1", [p.contractId]));
  });

  test('sin fiador: la cobertura 0..1 permite completar con arrendador y arrendatario', async () => {
   const p = await pending({ guarantor: false });
   assert.deepEqual(p.signers.map(s => s.rol), ['ARRENDADOR', 'ARRENDATARIO']);
   await signAll(p); await complete(p, await evidence(p));
   assert.equal(await contractState(p.contractId), 'FIRMADO');
  });

  // ---------------------------------------------------------------- permisos
  test('permisos: no admin, service_role o escrituras directas no registran nada', async () => {
   const p = await pending();
   await assert.rejects(sign(p, p.signers[0].id, { sub: ids.user }), err => err.code === '42501');
   await assert.rejects(service(() => db.query('select registrar_firma_firmante($1,$2,$3,$4,now())', [p.processId, p.signers[0].id, p.pdfSha, 'INE'])), /permission denied/);
   await assert.rejects(admin(() => db.query('select * from reservar_evidencia_firma($1,$2)', [ids.admin, p.processId])), /permission denied/);
   await assert.rejects(admin(() => db.query('select registrar_evidencia_firma($1,$2,$3,$4,$5,$6,$7,$8)', [ids.admin, p.processId, randomUUID(), sha('x'), 1, 'application/pdf', DECL, true])), /permission denied/);
   await assert.rejects(reserve(p, { actor: ids.user }), err => err.code === '42501');
   await assert.rejects(as('anon', () => db.query('select completar_proceso_firma($1,$2,$3)', [p.processId, randomUUID(), sha('x')])), /permission denied/);
   // Escrituras directas: sin privilegio (clientes) o rechazadas por el trigger (propietario fuera de RPC).
   for (const run of [admin, service]) {
    await assert.rejects(run(() => db.query("update firmantes_proceso set estado='FIRMADO' where proceso_firma_id=$1", [p.processId])), /permission denied/);
    await assert.rejects(run(() => db.query("insert into evidencias_firma(proceso_firma_id,storage_path,sha256,mime_type,size_bytes,uploaded_by) values($1,'x',$2,'application/pdf',1,$3)", [p.processId, sha('d'), ids.admin])), /permission denied/);
    await assert.rejects(run(() => db.query('insert into firma_privada.reservas_evidencia(id) values(gen_random_uuid())')), /permission denied/);
   }
   await assert.rejects(owner(() => db.query("update contratos set estado='FIRMADO' where id=$1", [p.contractId])), /cancelación, anulación o completado controlados/);
   await assert.rejects(owner(() => db.query("update procesos_firma set estado='COMPLETADO',completado_at=now() where id=$1", [p.processId])), /check constraint|faltan firmas/i);
   await assert.rejects(owner(() => db.query("insert into firma_privada.reservas_evidencia(id,proceso_firma_id,storage_path,reservado_por,reservado_at,expira_at) values(gen_random_uuid(),$1,'x/firmas/y.pdf',$2,now(),now()+interval '1 minute')", [p.processId, ids.admin])), /inconsistente/);
   assert.deepEqual(await signerStates(p.processId), ['PENDIENTE', 'PENDIENTE', 'PENDIENTE']);
   // Los admin solo leen (RLS); un usuario no admin no ve procesos ni evidencias.
   assert.equal((await as('authenticated', () => rows('select count(*)::int n from procesos_firma'), ids.user))[0].n, 0);
  });

  test('las RPC de servicio exigen admin aunque el servidor se equivoque de actor', async () => {
   const p = await pending();
   await assert.rejects(reserve(p, { actor: randomUUID() }), /Administrador inválido/);
   const r = await reserve(p); await put(r.ruta_storage);
   await assert.rejects(register(p, r.evidencia_id, { hash: sha('x'), actor: ids.user }), /Administrador inválido/);
   assert.equal(await evidenceCount(p.processId), 0);
  });

  // ---------------------------------------------------------------- firmantes
  test('firmante: ajeno, inexistente, duplicado, documento distinto, fecha o identificación inválidas', async () => {
   const p = await pending(); const other = await pending();
   const [landlord, tenant] = p.signers;
   await assert.rejects(sign(p, other.signers[0].id), /ajeno al proceso/);
   await assert.rejects(sign(p, randomUUID()), /ajeno al proceso o inexistente/);
   await assert.rejects(admin(() => db.query('select registrar_firma_firmante($1,$2,$3,$4,now())', [randomUUID(), landlord.id, p.pdfSha, 'INE'])), /Proceso inexistente/);
   await assert.rejects(sign(p, landlord.id, { origin: sha('otra revisión') }), /no corresponde al documento origen/);
   await assert.rejects(sign(p, landlord.id, { origin: other.pdfSha }), /no corresponde al documento origen/);
   for (const check of [null, '', 'CURP', 'ine']) await assert.rejects(sign(p, landlord.id, { check }), /identificación verificada inválido/);
   await assert.rejects(sign(p, landlord.id, { at: null }), /Fecha declarada de firma obligatoria/);
   await assert.rejects(sign(p, landlord.id, { at: '2000-01-01T00:00:00Z' }), /Fecha de firma fuera/);
   await assert.rejects(sign(p, landlord.id, { at: new Date(Date.now() + 3600e3).toISOString() }), /Fecha de firma fuera/);
   await sign(p, landlord.id, { check: 'PASAPORTE' });
   await assert.rejects(sign(p, landlord.id), /ya registrada/);
   await assert.rejects(sign(p, landlord.id, { sub: ids.admin2 }), /ya registrada/);
   const row = (await rows('select registrado_por,verificacion_identidad from firmantes_proceso where id=$1', [landlord.id]))[0];
   assert.deepEqual(row, { registrado_por: ids.admin, verificacion_identidad: 'PASAPORTE' });
   assert.equal((await rows('select estado from firmantes_proceso where id=$1', [tenant.id]))[0].estado, 'PENDIENTE');
  });

  test('fecha declarada de firma y fecha de registro se conservan por separado; sin datos de la identificación', async () => {
   const p = await pending();
   const started = (await processRow(p.processId)).iniciado_at;
   await sign(p, p.signers[0].id, { at: started.toISOString() });
   const s = (await rows('select firmado_at,registrado_at from firmantes_proceso where id=$1', [p.signers[0].id]))[0];
   assert.equal(s.firmado_at.getTime(), started.getTime());
   assert.ok(s.registrado_at > s.firmado_at);
   const columns = (await rows("select column_name from information_schema.columns where table_schema='public' and table_name='firmantes_proceso'")).map(r => r.column_name);
   assert.deepEqual(columns.filter(c => /identific|ine|pasaporte|documento_numero|numero/i.test(c)), []);
   assert.match((await rows("select col_description('public.firmantes_proceso'::regclass,attnum) d from pg_attribute where attrelid='public.firmantes_proceso'::regclass and attname='firmado_at'"))[0].d, /DECLARADAS/);
  });

  // ---------------------------------------------------------------- estados
  test('proceso cancelado o contrato no pendiente: sin firmas, reservas, evidencias ni completado', async () => {
   const p = await pending();
   await cancel(p);
   await assert.rejects(sign(p, p.signers[0].id), /no pendiente/);
   await assert.rejects(reserve(p), /no pendiente/);
   await assert.rejects(complete(p, { id: randomUUID(), sha: sha('x') }), /no pendiente/);
   assert.equal(await contractState(p.contractId), 'BORRADOR');
   assert.equal(await evidenceCount(p.processId), 0);
  });

  test('con una firma o evidencia el proceso ya no se cancela (regla de la etapa 1); una reserva sola no lo impide', async () => {
   const p = await pending();
   await sign(p, p.signers[0].id);
   await assert.rejects(cancel(p, 'Se arrepintió'), /firmas\/evidencias/);
   const q = await pending();
   await evidence(q);
   await assert.rejects(cancel(q, 'x'), /firmas\/evidencias/);
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   const r = await pending();
   await reserve(r);
   await cancel(r);
   assert.equal(await contractState(r.contractId), 'BORRADOR');
  });

  // ---------------------------------------------------------------- evidencia inválida
  test('evidencia: formato, declaración, reserva, objeto en Storage, origen sin firmar y reutilización', async () => {
   const p = await pending(); const other = await pending();
   const r = await reserve(p); const content = sha('ok-' + randomUUID());
   await put(r.ruta_storage, { bytes: 4096 });
   for (const [options, message] of [
    [{ hash: 'ab'.repeat(31) + 'zz' }, /SHA-256 inválido/], [{ bytes: 0 }, /Tamaño de PDF inválido/], [{ bytes: 10485761 }, /Tamaño de PDF inválido/],
    [{ mime: 'image/png' }, /application\/pdf/], [{ confirm: false }, /debe confirmar/], [{ confirm: null }, /debe confirmar/],
    [{ version: 'PDF_FIRMADO_CORRESPONDE_V0' }, /no vigente/], [{ version: null }, /no vigente/],
    [{ bytes: 4095 }, /no existe en Storage/], [{ hash: p.pdfSha }, /documento origen sin firmar/], [{ hash: other.pdfSha }, /documento origen sin firmar/],
    [{ actor: ids.admin2 }, /inexistente o ajena/]]) {
    await assert.rejects(register(p, r.evidencia_id, { hash: content, ...options }), message, JSON.stringify(options));
   }
   const foreign = await reserve(other);
   await assert.rejects(register(p, foreign.evidencia_id, { hash: content }), /inexistente o ajena/);
   await assert.rejects(register(p, randomUUID(), { hash: content }), /inexistente o ajena/);
   const wrongMime = await reserve(p); await put(wrongMime.ruta_storage, { mime: 'application/octet-stream' });
   await assert.rejects(register(p, wrongMime.evidencia_id, { hash: content }), /no existe en Storage/);
   const early = await reserve(p);
   await put(early.ruta_storage, { createdAt: new Date((await reservation(early.evidencia_id)).reservado_at.getTime() - 1000).toISOString() });
   await assert.rejects(register(p, early.evidencia_id, { hash: content }), /anterior a la reserva/);
   assert.equal(await evidenceCount(p.processId), 0);
   const id = await register(p, r.evidencia_id, { hash: content });
   assert.equal(id, r.evidencia_id);
   await assert.rejects(register(p, id, { hash: sha('otro') }), /ya está registrada con otros datos/);
   await assert.rejects(register(p, id, { hash: content, bytes: 4095 }), /ya está registrada con otros datos/);
   await assert.rejects(evidence(p, { content }), /ya se registró como evidencia/);
   await assert.rejects(evidence(other, { content }), /ya se registró como evidencia/);
   // Reserva vencida: ya no admite registro aunque el objeto esté subido.
   const late = await reserve(other); await put(late.ruta_storage); await expire(late.evidencia_id);
   await assert.rejects(register(other, late.evidencia_id, { hash: sha('tarde') }), /vencida o ya usada/);
  });

  test('máximo cinco evidencias por proceso, contando las reservas vigentes', async () => {
   const p = await pending();
   await evidence(p);
   const open = [];
   for (let i = 0; i < 4; i++) open.push(await reserve(p));
   await assert.rejects(reserve(p), /Límite de evidencias/);
   await expire(open[0].evidencia_id);
   const again = await reserve(p);
   await put(again.ruta_storage); await register(p, again.evidencia_id, { hash: sha('dos-' + randomUUID()) });
   for (const r of open.slice(1)) { await put(r.ruta_storage); await register(p, r.evidencia_id, { hash: sha('n-' + randomUUID()) }); }
   assert.equal(await evidenceCount(p.processId), 5);
   await assert.rejects(reserve(p), /Límite de evidencias/);
  });

  // ---------------------------------------------------------------- completar
  test('completar: faltan firmas, evidencia ajena, hash distinto, previa a la firma, sustituida o borrada', async () => {
   const p = await pending(); const other = await pending();
   const otherEvidence = await evidence(other);
   const ev = await evidence(p);
   await assert.rejects(complete(p, ev), /Faltan firmas/);
   await sign(p, p.signers[0].id); await sign(p, p.signers[1].id);
   await assert.rejects(complete(p, ev), /Faltan firmas/);
   await sign(p, p.signers[2].id);
   await assert.rejects(complete(p, otherEvidence), /ajena al proceso/);
   await assert.rejects(complete(p, { id: randomUUID(), sha: ev.sha }), /ajena al proceso o inexistente/);
   await assert.rejects(complete(p, ev, { hash: otherEvidence.sha }), /hash de la evidencia no coincide/);
   // Evidencia registrada antes del registro de la última firma: no puede contenerlas todas.
   await assert.rejects(complete(p, ev), /anterior al registro de la última firma/);
   const late = await evidence(p);
   await assert.rejects(complete(p, late, { sub: ids.user }), err => err.code === '42501');
   // Sustitución o borrado fuera de banda (clave de servicio, panel): ninguna política lo impide; completar lo detecta.
   await bypass(`update storage.objects set metadata=metadata||'{"eTag":"\\"sustituido\\""}'::jsonb where name=$1`, [late.path]);
   await assert.rejects(complete(p, late), /ya no está en Storage o fue sustituido/);
   const gone = await evidence(p);
   await bypass('delete from storage.objects where name=$1', [gone.path]);
   await assert.rejects(complete(p, gone), /ya no está en Storage o fue sustituido/);
   assert.equal((await processRow(p.processId)).estado, 'PENDIENTE'); assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   await complete(p, await evidence(p));
   assert.equal(await contractState(p.contractId), 'FIRMADO');
  });

  test('cobertura: completar exige la cobertura congelada al iniciar, sin modificarla', async () => {
   const p = await pending();
   await signAll(p); const ev = await evidence(p);
   await db.exec('BEGIN');
   await owner(() => db.query("insert into firma_privada.cobertura_plantilla(version_plantilla_id,sha256_contenido,rol,minimo,maximo,entidades,aprobacion) values($1,$2,'OBLIGADO_SOLIDARIO',0,1,'{PERSONA}','cambio')", [ids.v2, sha(HTML_V2)]));
   await assert.rejects(complete(p, ev), /cobertura aprobada de la plantilla cambió/);
   await abort();
   assert.equal((await owner(() => rows('select count(*)::int n from firma_privada.cobertura_plantilla where version_plantilla_id=$1', [ids.v2])))[0].n, 3);
   await complete(p, ev);
  });

  // ---------------------------------------------------------------- fallos parciales y atomicidad
  async function withInjectedFailure(state, fn) {
   await db.exec(`CREATE FUNCTION public.fallo_inyectado() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo inyectado'; END $$;
    CREATE TRIGGER fallo_inyectado BEFORE UPDATE ON public.contratos FOR EACH ROW WHEN (NEW.estado::text='${state}') EXECUTE FUNCTION public.fallo_inyectado();`);
   try { await assert.rejects(fn(), /fallo inyectado/); }
   finally { await db.exec('DROP TRIGGER fallo_inyectado ON public.contratos; DROP FUNCTION public.fallo_inyectado();'); }
  }

  test('fallo a mitad del completado: ni proceso ni contrato cambian', async () => {
   const p = await pending();
   await signAll(p); const ev = await evidence(p);
   // Fallo inyectado en el último paso (UPDATE del contrato), después de actualizar el proceso.
   await withInjectedFailure('FIRMADO', () => complete(p, ev));
   const process = await processRow(p.processId);
   assert.deepEqual([process.estado, process.completado_por, process.evidencia_firmada_id], ['PENDIENTE', null, null]);
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   await complete(p, ev);
   assert.equal(await contractState(p.contractId), 'FIRMADO');
  });

  test('al COMMIT: el propietario tampoco deja un proceso completado con el contrato pendiente', async () => {
   const p = await pending();
   await signAll(p); const ev = await evidence(p);
   await db.exec('BEGIN');
   await owner(() => db.query("update procesos_firma set estado='COMPLETADO',completado_at=now(),completado_por=$2,evidencia_firmada_id=$3,sha256_documento_firmado=$4 where id=$1", [p.processId, ids.admin, ev.id, ev.sha]));
   await assert.rejects(db.exec('COMMIT'), /deben cambiar atómicamente|inconsistente/);
   await db.exec('reset role');
   assert.equal((await processRow(p.processId)).estado, 'PENDIENTE');
   // Ni cambiar un firmante ya FIRMADO, ni borrar evidencias, firmantes o reservas, aun como propietario.
   await assert.rejects(owner(() => db.query("update firmantes_proceso set verificacion_identidad='OTRA' where id=$1", [p.signers[0].id])), /solo un registro PENDIENTE -> FIRMADO/);
   await assert.rejects(owner(() => db.query('delete from firmantes_proceso where id=$1', [p.signers[0].id])), /No se elimina/);
   await assert.rejects(owner(() => db.query("update evidencias_firma set sha256=$2 where id=$1", [ev.id, sha('y')])), /inmutables/);
   await assert.rejects(owner(() => db.query('delete from evidencias_firma where id=$1', [ev.id])), /inmutables/);
   await assert.rejects(owner(() => db.query('delete from firma_privada.reservas_evidencia where id=$1', [ev.id])), /No se eliminan reservas/);
   await assert.rejects(owner(() => db.query('update firma_privada.reservas_evidencia set consumida_at=now() where id=$1', [ev.id])), /solo se marca una vez/);
   await complete(p, ev);
   await assert.rejects(owner(() => db.query("update procesos_firma set motivo_cancelacion='x' where id=$1", [p.processId])), /Proceso cerrado/);
  });

  // ---------------------------------------------------------------- huérfanos
  test('huérfanos: subida correcta y registro fallido -> reserva vencida, listada y limpiada sin tocar evidencias', async () => {
   const p = await pending();
   const r = await reserve(p);
   await put(r.ruta_storage, { bytes: 1 });
   await assert.rejects(register(p, r.evidencia_id, { hash: sha('x'), bytes: 4096 }), /no existe en Storage/);
   assert.equal(await evidenceCount(p.processId), 0);
   const listed = async () => (await service(() => rows('select * from listar_reservas_evidencia_vencidas(500)'))).find(x => x.reserva_id === r.evidencia_id);
   const mark = id => service(() => db.query('select marcar_reserva_evidencia_limpiada($1)', [id]));
   // Vigente: no aparece y no se puede marcar (el servidor aún podría registrarla).
   assert.equal(await listed(), undefined);
   await assert.rejects(mark(r.evidencia_id), /aún no vencida/);
   await expire(r.evidencia_id);
   assert.deepEqual(await listed(), { reserva_id: r.evidencia_id, ruta_storage: r.ruta_storage, vence_at: (await reservation(r.evidencia_id)).expira_at, objeto_presente: true });
   await assert.rejects(mark(r.evidencia_id), /sigue en Storage/);
   // Vencida: ya no se puede registrar, así que borrar su objeto es seguro.
   await assert.rejects(register(p, r.evidencia_id, { hash: sha('x'), bytes: 1 }), /vencida o ya usada/);
   assert.equal((await service(() => db.query('delete from storage.objects where name=$1', [r.ruta_storage]))).affectedRows, 1);
   await mark(r.evidencia_id); await mark(r.evidencia_id);
   assert.ok((await reservation(r.evidencia_id)).limpiada_at);
   assert.equal(await listed(), undefined);
   // Si el objeto reaparece (subida tardía), vuelve a listarse.
   await put(r.ruta_storage);
   assert.equal((await listed()).objeto_presente, true);
   // Una reserva consumida nunca es huérfana, aunque esté vencida.
   const ev = await evidence(p); await expire(ev.id);
   assert.equal((await service(() => rows('select * from listar_reservas_evidencia_vencidas(500)'))).some(x => x.reserva_id === ev.id), false);
   await assert.rejects(mark(ev.id), /consumida/);
   await assert.rejects(mark(randomUUID()), /Reserva inexistente/);
   for (const run of [admin, fn => as('anon', fn)]) {
    await assert.rejects(run(() => db.query('select * from listar_reservas_evidencia_vencidas(1)')), /permission denied/);
    await assert.rejects(run(() => db.query('select marcar_reserva_evidencia_limpiada($1)', [r.evidencia_id])), /permission denied/);
   }
  });

  // ---------------------------------------------------------------- anulación administrativa
  test('anulación: autorización, también frente a escrituras directas del propietario', async () => {
   const p = await pending();
   await sign(p, p.signers[0].id);
   await assert.rejects(annul(p, { sub: ids.user }), err => err.code === '42501');
   await assert.rejects(as('anon', () => db.query('select anular_proceso_firma($1,$2,$3)', [p.processId, 'Motivo suficiente', 'BORRADOR'])), /permission denied/);
   await assert.rejects(service(() => db.query('select anular_proceso_firma($1,$2,$3)', [p.processId, 'Motivo suficiente', 'BORRADOR'])), /permission denied/);
   const set = "estado='ANULADO',anulado_at=now(),anulado_por=$2,motivo_anulacion='Motivo suficiente',destino_contrato_anulacion='BORRADOR'";
   await assert.rejects(admin(() => db.query(`update procesos_firma set ${set} where id=$1`, [p.processId, ids.admin])), /permission denied/);
   await db.exec('BEGIN');
   await assert.rejects(owner(() => db.query(`update procesos_firma set ${set} where id=$1`, [p.processId, ids.user])), err => err.code === '42501');
   await abort();
   const empty = await pending();
   await db.exec('BEGIN');
   await assert.rejects(owner(() => db.query(`update procesos_firma set ${set} where id=$1`, [empty.processId, ids.admin])), /se cancela, no se anula/);
   await abort();
   // Ni el propietario puede sacar el contrato a CANCELADO sin anular, ni con un destino distinto del registrado.
   await assert.rejects(owner(() => db.query("update contratos set estado='CANCELADO' where id=$1", [p.contractId])), /cancelación, anulación o completado controlados/);
   await db.exec('BEGIN');
   await owner(() => db.query(`update procesos_firma set ${set} where id=$1`, [p.processId, ids.admin]));
   await assert.rejects(owner(() => db.query("update contratos set estado='CANCELADO' where id=$1", [p.contractId])), /solo mediante anulación/);
   await abort();
   await db.exec('BEGIN');
   await owner(() => db.query(`update procesos_firma set ${set.replace("'BORRADOR'", "'CANCELADO'")} where id=$1`, [p.processId, ids.admin]));
   await assert.rejects(owner(() => db.query("update contratos set estado='BORRADOR' where id=$1", [p.contractId])), /destino registrado en la anulación/);
   await abort();
   // Proceso anulado sin mover el contrato: falla al COMMIT.
   await db.exec('BEGIN');
   await owner(() => db.query(`update procesos_firma set ${set} where id=$1`, [p.processId, ids.admin]));
   await assert.rejects(db.exec('COMMIT'), /deben cambiar atómicamente/);
   await db.exec('reset role');
   assert.equal((await processRow(p.processId)).estado, 'PENDIENTE');
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
  });

  test('anulación: motivo, destino y proceso validados; sin firmas ni evidencias se cancela, no se anula', async () => {
   const p = await pending();
   await sign(p, p.signers[0].id);
   for (const reason of [null, '', '          ', 'Muy corto', 'x'.repeat(1001)]) await assert.rejects(annul(p, { reason }), /Motivo de anulación obligatorio/, String(reason));
   for (const dest of [null, '', 'FIRMADO', 'borrador', 'PENDIENTE_FIRMA']) await assert.rejects(annul(p, { dest }), /Destino del contrato inválido/, String(dest));
   await assert.rejects(admin(() => db.query('select anular_proceso_firma($1,$2,$3)', [randomUUID(), 'Motivo suficiente', 'BORRADOR'])), /Proceso inexistente/);
   const empty = await pending();
   await reserve(empty);
   await assert.rejects(annul(empty), /usa cancelar_proceso_firma/);
   assert.equal((await processRow(p.processId)).estado, 'PENDIENTE');
   assert.equal((await processRow(empty.processId)).estado, 'PENDIENTE');
  });

  test('anulación a BORRADOR: auditoría, historial intacto, sin nuevas firmas y reinicio solo con una revisión nueva', async () => {
   const p = await pending();
   await sign(p, p.signers[0].id, { check: 'PASAPORTE' });
   await evidence(p);
   const open = await reserve(p); await put(open.ruta_storage);
   const before = await history(p);
   await annul(p, { reason: '  El fiador se negó a firmar el contrato  ', sub: ids.admin2 });
   const process = await processRow(p.processId);
   assert.deepEqual([process.estado, process.anulado_por, process.motivo_anulacion, process.destino_contrato_anulacion],
    ['ANULADO', ids.admin2, 'El fiador se negó a firmar el contrato', 'BORRADOR']);
   assert.ok(process.anulado_at >= process.iniciado_at);
   assert.deepEqual([process.cancelado_at, process.completado_at, process.completado_por, process.evidencia_firmada_id], [null, null, null, null]);
   assert.equal(await contractState(p.contractId), 'BORRADOR');
   // Firmas, evidencias y documento origen, idénticos.
   assert.deepEqual(await history(p), before);
   // Bloqueo de nuevas firmas, evidencias, completado, cancelación y una segunda anulación.
   await assert.rejects(sign(p, p.signers[1].id), /no pendiente/);
   await assert.rejects(reserve(p), /no pendiente/);
   await assert.rejects(register(p, open.evidencia_id, { hash: sha('tarde') }), /no pendiente/);
   await assert.rejects(complete(p, { id: before.evidences[0].id, sha: before.evidences[0].sha256 }), /no pendiente/);
   await assert.rejects(cancel(p), /no pendiente/);
   await assert.rejects(annul(p), /no pendiente/);
   await assert.rejects(owner(() => db.query("update procesos_firma set motivo_anulacion='Otro motivo distinto' where id=$1", [p.processId])), /Proceso cerrado \(ANULADO\)/);
   await assert.rejects(owner(() => db.query("update firmantes_proceso set estado='FIRMADO',firmado_at=now(),registrado_por=$2,registrado_at=now(),verificacion_identidad='INE' where id=$1", [p.signers[1].id, ids.admin])), /solo en procesos pendientes/);
   await assert.rejects(owner(() => db.query('delete from evidencias_firma where proceso_firma_id=$1', [p.processId])), /inmutables/);
   await assert.rejects(owner(() => db.query('delete from procesos_firma where id=$1', [p.processId])), /No se elimina/);
   // El PDF con firmas parciales no vuelve a circular: ni el mismo documento ni el mismo hash.
   await assert.rejects(start(p.contractId, { documentId: p.documentId }), /no elegible/);
   await assert.rejects(start(p.contractId, { pdfSha: p.pdfSha }), /pertenece a un proceso anulado/);
   const next = await start(p.contractId);
   assert.notEqual(next.documentId, p.documentId);
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   assert.equal((await processRow(p.processId)).estado, 'ANULADO');
   await signAll(next); await complete(next, await evidence(next));
   assert.equal(await contractState(p.contractId), 'FIRMADO');
   assert.deepEqual(await history(p), before);
  });

  test('anulación a CANCELADO (incluso con todas las firmas): contrato terminal, historial intacto', async () => {
   const q = await pending();
   await evidence(q);
   await annul(q, { dest: 'CANCELADO', reason: 'La operación de arrendamiento no seguirá' });
   assert.equal(await contractState(q.contractId), 'CANCELADO');
   assert.equal((await processRow(q.processId)).destino_contrato_anulacion, 'CANCELADO');
   await assert.rejects(owner(() => db.query("update contratos set estado='BORRADOR' where id=$1", [q.contractId])), /no permitida/);
   await assert.rejects(owner(() => db.query('delete from contratos where id=$1', [q.contractId])), /historial de firma no eliminable/);
   // Todas las firmas registradas pero sin poder completar (p. ej. la cobertura cambió): la anulación es la salida.
   const r = await pending();
   await signAll(r);
   const before = await history(r);
   await annul(r, { dest: 'CANCELADO', reason: 'La cobertura de la plantilla cambió tras firmar' });
   assert.equal(await contractState(r.contractId), 'CANCELADO');
   assert.deepEqual(await history(r), before);
  });

  test('anulación atómica: un fallo al mover el contrato deja proceso y contrato como estaban', async () => {
   const p = await pending();
   await sign(p, p.signers[0].id);
   await withInjectedFailure('BORRADOR', () => annul(p));
   await withInjectedFailure('CANCELADO', () => annul(p, { dest: 'CANCELADO' }));
   const process = await processRow(p.processId);
   assert.deepEqual([process.estado, process.anulado_at, process.anulado_por, process.motivo_anulacion], ['PENDIENTE', null, null, null]);
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   await annul(p);
   assert.equal(await contractState(p.contractId), 'BORRADOR');
  });

  test('concurrencia (orden secuencial de las carreras): quien llega segundo ve el estado del primero', async () => {
   // Anular vs completar, en ambos órdenes.
   const a = await pending(); await signAll(a); const ea = await evidence(a);
   await complete(a, ea); await assert.rejects(annul(a), /no pendiente/);
   const b = await pending(); await signAll(b); const eb = await evidence(b);
   await annul(b); await assert.rejects(complete(b, eb), /no pendiente/);
   // Anular vs firmar y anular vs registrar una evidencia ya subida.
   const c = await pending(); await sign(c, c.signers[0].id);
   const rc = await reserve(c); await put(rc.ruta_storage);
   await annul(c);
   await assert.rejects(sign(c, c.signers[1].id), /no pendiente/);
   await assert.rejects(register(c, rc.evidencia_id, { hash: sha('c') }), /no pendiente/);
   // Anular vs cancelar: con firmas solo cabe anular; doble anulación.
   const d = await pending(); await sign(d, d.signers[0].id);
   await assert.rejects(cancel(d), /firmas\/evidencias/);
   await annul(d, { sub: ids.admin }); await assert.rejects(annul(d, { sub: ids.admin2 }), /no pendiente/);
   assert.equal((await processRow(d.processId)).anulado_por, ids.admin);
  });

  test('bloqueos: todas las RPC de etapa 2 bloquean contrato -> proceso -> reserva antes de escribir', () => {
   const bodyOf = name => STAGE2.slice(STAGE2.indexOf(`CREATE FUNCTION public.${name}(`)).split('END $$;')[0];
   const firstWrite = body => Math.min(...['UPDATE public.', 'INSERT INTO public.', 'UPDATE firma_privada.', 'INSERT INTO firma_privada.'].map(w => body.indexOf(w)).filter(i => i >= 0));
   for (const name of ['registrar_firma_firmante', 'reservar_evidencia_firma', 'registrar_evidencia_firma', 'completar_proceso_firma', 'anular_proceso_firma']) {
    const body = bodyOf(name);
    const contractLock = body.indexOf('FROM public.contratos WHERE id=v_cid FOR UPDATE'), processLock = body.indexOf('FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE');
    assert.ok(contractLock > 0 && contractLock < processLock && processLock < firstWrite(body), name);
    assert.match(body, /SET lock_timeout='5s'/);
   }
   const evidenceBody = bodyOf('registrar_evidencia_firma');
   const reserveLock = evidenceBody.indexOf('FROM firma_privada.reservas_evidencia WHERE id=p_evidencia FOR UPDATE');
   assert.ok(evidenceBody.indexOf('FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE') < reserveLock && reserveLock < evidenceBody.indexOf('firma_privada.objeto_pdf('));
   const cleanup = bodyOf('marcar_reserva_evidencia_limpiada');
   const order = ['FROM public.contratos WHERE id=v_cid FOR UPDATE', 'FROM public.procesos_firma WHERE id=v_pid FOR UPDATE', 'FROM firma_privada.reservas_evidencia WHERE id=p_reserva FOR UPDATE', 'UPDATE firma_privada.'].map(s => cleanup.indexOf(s));
   assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), 'marcar_reserva_evidencia_limpiada');
   // Ninguna RPC bloquea el proceso antes que el contrato.
   for (const name of ['cancelar_proceso_firma']) {
    const body = STAGE1.slice(STAGE1.indexOf(`CREATE FUNCTION public.${name}(`)).split('END $$;')[0];
    assert.ok(body.indexOf('FROM public.contratos WHERE id=v_cid FOR UPDATE') < body.indexOf('FROM public.procesos_firma WHERE id=p_proceso FOR UPDATE'));
   }
  });

  // ---------------------------------------------------------------- Storage (configuración real, sin 06 instalable)
  const browserWrites = async (p, run) => {
   const path = `${p.contractId}/firmas/${p.processId}/${randomUUID()}/firmado.pdf`;
   const insert = run(() => db.query("insert into storage.objects(bucket_id,name,metadata) values('contract-documents',$1,'{}')", [path]));
   const upsert = run(() => db.query(`insert into storage.objects(bucket_id,name,metadata) values('contract-documents',$1,'{}')
    on conflict(bucket_id,name) do update set metadata=excluded.metadata`, [p.evidencePath]));
   const results = await Promise.allSettled([insert, upsert]);
   return {
    insert: results[0].status, upsert: results[1].status,
    update: (await run(() => db.query(`update storage.objects set metadata=metadata||'{"eTag":"\\"x\\""}'::jsonb where name=$1`, [p.evidencePath]))).affectedRows,
    move: (await run(() => db.query("update storage.objects set name=name||'.bak' where name=$1", [p.evidencePath]))).affectedRows,
    delete: (await run(() => db.query('delete from storage.objects where name=$1', [p.evidencePath]))).affectedRows,
   };
  };
  const storagePolicies = async () => (await rows("select policyname from pg_policies where schemaname='storage' order by 1")).map(r => r.policyname);
  const dropPolicies = async () => { for (const name of await storagePolicies()) await db.exec(`DROP POLICY ${name} ON storage.objects`); };

  test('Storage sin políticas de escritura (S5/C1 vacíos): el navegador no crea, sustituye, mueve ni borra en contract-documents', async () => {
   const p = await pending(); const ev = await evidence(p); p.evidencePath = ev.path;
   const before = (await rows('select id,name,metadata from storage.objects where name=$1', [ev.path]))[0];
   for (const run of [fn => admin(fn), fn => as('anon', fn)]) {
    assert.deepEqual(await browserWrites(p, run), { insert: 'rejected', upsert: 'rejected', update: 0, move: 0, delete: 0 });
   }
   assert.deepEqual((await rows('select id,name,metadata from storage.objects where name=$1', [ev.path]))[0], before);
   assert.deepEqual((await owner(() => rows(section(STORAGE_CONTROLS, 'C1')))), []);
  });

  test('una política permisiva sin filtro de bucket abre contract-documents al navegador; C1 la detecta y una filtrada a otro bucket no', async () => {
   const p = await pending(); const ev = await evidence(p); p.evidencePath = ev.path;
   await db.exec(`CREATE POLICY avatars_propios ON storage.objects FOR ALL TO authenticated USING(bucket_id='avatars') WITH CHECK(bucket_id='avatars');`);
   try {
    assert.deepEqual(await browserWrites(p, fn => admin(fn)), { insert: 'rejected', upsert: 'rejected', update: 0, move: 0, delete: 0 });
    await db.exec('CREATE POLICY todo_abierto ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true)');
    const flagged = await owner(() => rows(section(STORAGE_CONTROLS, 'C1')));
    assert.deepEqual(flagged.map(f => [f.policyname, f.sin_filtro_de_bucket]), [['avatars_propios', false], ['todo_abierto', true]]);
    // Con la política amplia, un admin desde el navegador puede borrar la evidencia (no hay trigger que lo impida).
    assert.equal((await admin(() => db.query('delete from storage.objects where name=$1', [ev.path]))).affectedRows, 1);
    assert.equal((await owner(() => rows(section(STORAGE_CONTROLS, 'C3')))).find(x => x.evidencia_id === ev.id).problema, 'AUSENTE');
   } finally { await dropPolicies(); }
  });

  test('políticas restrictivas opcionales del diseño (solo si el panel puede crearlas): bloquean al navegador aun con una política amplia; no a service_role', async () => {
   const policies = DESIGN.match(/```sql\n(-- Políticas restrictivas opcionales[\s\S]*?)```/)[1];
   const p = await pending(); const ev = await evidence(p); p.evidencePath = ev.path;
   // Se crean con derechos de propietario, como lo haría el panel si lo admite; el instalador no puede.
   await assert.rejects(owner(() => db.exec(policies)), /must be owner/);
   await db.exec(policies);
   await db.exec('CREATE POLICY todo_abierto ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true)');
   try {
    for (const run of [fn => admin(fn), fn => as('anon', fn)]) {
     assert.deepEqual(await browserWrites(p, run), { insert: 'rejected', upsert: 'rejected', update: 0, move: 0, delete: 0 });
    }
    // Otros buckets siguen funcionando con sus políticas.
    assert.equal((await admin(() => db.query("insert into storage.objects(bucket_id,name,metadata) values('avatars',$1,'{}')", [randomUUID()]))).affectedRows, 1);
    // service_role (clave de servicio, API de Storage del servidor, panel) ignora RLS: sigue pudiendo sustituir.
    assert.equal((await service(() => db.query(`update storage.objects set metadata=metadata||'{"eTag":"\\"otro\\""}'::jsonb where name=$1`, [ev.path]))).affectedRows, 1);
    assert.equal((await owner(() => rows(section(STORAGE_CONTROLS, 'C3')))).find(x => x.evidencia_id === ev.id).problema, 'CONTENIDO_DISTINTO');
   } finally { await dropPolicies(); }
  });

  test('riesgo residual de service_role: completar rechaza un objeto sustituido y C3/C4 detectan cambios posteriores al completado', async () => {
   const q = await pending(); await signAll(q); const swapped = await evidence(q);
   await service(() => db.query(`update storage.objects set metadata=metadata||'{"eTag":"\\"otro\\""}'::jsonb where name=$1`, [swapped.path]));
   await assert.rejects(complete(q, swapped), /fue sustituido/);
   const p = await pending(); await signAll(p); const ev = await evidence(p);
   await complete(p, ev);
   const c3 = async () => (await owner(() => rows(section(STORAGE_CONTROLS, 'C3')))).find(x => x.evidencia_id === ev.id);
   assert.equal(await c3(), undefined);
   await service(() => db.query(`update storage.objects set metadata=metadata||'{"eTag":"\\"tras-completar\\""}'::jsonb where name=$1`, [ev.path]));
   assert.deepEqual(await c3(), { evidencia_id: ev.id, proceso_firma_id: p.processId, estado_proceso: 'COMPLETADO', es_la_firmada: true, problema: 'CONTENIDO_DISTINTO' });
   await service(() => db.query('delete from storage.objects where name=$1', [ev.path]));
   assert.equal((await c3()).problema, 'AUSENTE');
   // PDF origen: presente con su tamaño -> sin fila; ausente -> AUSENTE.
   const c4 = async () => (await owner(() => rows(section(STORAGE_CONTROLS, 'C4')))).find(x => x.proceso === p.processId);
   assert.equal((await c4()).problema, 'AUSENTE');
   await put((await processRow(p.processId)).storage_path_origen, { bytes: 2048 });
   assert.equal(await c4(), undefined);
  });

  test('C5/C6 clasifican los objetos de /firmas/: evidencia, reserva vigente, huérfano limpiable y anomalía sin reserva', async () => {
   const p = await pending();
   await evidence(p);
   const live = await reserve(p); await put(live.ruta_storage);
   const stale = await reserve(p); await put(stale.ruta_storage); await expire(stale.evidencia_id);
   await put(`${p.contractId}/firmas/${p.processId}/${randomUUID()}/firmado.pdf`);
   const classes = (await owner(() => rows(section(STORAGE_CONTROLS, 'C5')))).map(r => r.clase);
   for (const c of ['EVIDENCIA', 'RESERVA_VIGENTE', 'HUERFANO_LIMPIABLE', 'SIN_RESERVA']) assert.ok(classes.includes(c), c);
   assert.ok((await owner(() => rows(section(STORAGE_CONTROLS, 'C6'))))[0].reservas_vencidas_sin_limpiar >= 1);
   // La tarea de limpieza solo recibe la reserva vencida, nunca la evidencia ni el objeto sin reserva.
   const listed = (await service(() => rows('select * from listar_reservas_evidencia_vencidas(500)'))).map(r => r.ruta_storage);
   assert.ok(listed.includes(stale.ruta_storage));
   assert.ok(!listed.includes(live.ruta_storage));
   assert.ok(listed.every(path => !path.includes(`/${p.processId}/`) || path === stale.ruta_storage));
  });
 });
}

suite('estado text', { enums: false });
suite('estado enum', { enums: true });
