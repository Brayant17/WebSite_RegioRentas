import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, randomUUID, createHash, createHmac } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
// Firma electrónica simple de 2C (07) en PostgreSQL local en memoria (PGlite). Jamás contra Supabase.
const { reviewRepresentation, representationQuality } = await import('../src/modules/admin/arrendamiento/contratos/firmas/representationReview.ts');
const { representativeCharacters } = await import('../src/modules/admin/configuracion/arrendador/types.ts');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const STAGE1 = read('../docs/sql/firmas-2c/02_infraestructura_corregida.sql');
// 04 (firma autógrafa) es una propuesta anterior, descartada y fuera del repositorio. Si existe localmente,
// se comprueba además que 04 y 07 se rechazan entre sí; si no, esas comprobaciones se omiten.
const AUTOGRAPH_URL = new URL('../docs/sql/firmas-2c/04_etapa2_firma_autografa.sql', import.meta.url);
const AUTOGRAPH = existsSync(AUTOGRAPH_URL) ? readFileSync(AUTOGRAPH_URL, 'utf8') : null;
const SKIP_AUTOGRAPH = AUTOGRAPH ? false : 'el SQL 04 no está en el repositorio';
const ESF = read('../docs/sql/firmas-2c/07_firma_electronica_simple.sql');
const SECRET = 'secreto-de-servidor-solo-para-pruebas';
const CONSENT = 'CONSENTIMIENTO_FES_V2';
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
const EMAILS = { ARRENDADOR: 'representante@example.com', ARRENDATARIO: 'inquilino@example.com', FIADOR: 'fiador@example.com' };
const SERVICE_RPCS = ['public.emitir_invitacion_firma(uuid,uuid,uuid,text,integer)', 'public.cambiar_correo_firmante(uuid,uuid,uuid,text,text)', 'public.revocar_invitacion_firma(uuid,uuid,text)', 'public.consultar_evidencia_firma(uuid,uuid)',
 'public.abrir_invitacion_firma(text,inet,text)', 'public.registrar_visualizacion_firma(text,text,inet,text)', 'public.registrar_consentimiento_firma(text,text,text,boolean,inet,text)',
 'public.emitir_otp_firma(text,text,inet,text)', 'public.firmar_documento_electronico(text,text,text,text,text,boolean,inet,text)',
 'public.obtener_firma_dibujada(uuid,uuid)', 'public.listar_procesos_por_finalizar(integer)', 'public.datos_pdf_final_firma(uuid)', 'public.registrar_pdf_final_firma(uuid,text,text,text,bigint,text)'];
const ADMIN_RPCS = ['public.anular_proceso_firma(uuid,text,text)'];
const PRIVATE_TABLES = ['cambios_correo_firmante', 'invitaciones_firma', 'eventos_firma', 'consentimientos_firma', 'otps_firma', 'firmas_electronicas', 'pdfs_finales_firma'].map(t => `firma_privada.${t}`);

// Réplica de Supabase Storage con los privilegios verificados: otro propietario, instalador con solo SELECT.
const STORAGE = `
CREATE ROLE storage_admin_sim NOLOGIN;
CREATE SCHEMA storage AUTHORIZATION storage_admin_sim;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets,name text,owner uuid,
 owner_id text,metadata jsonb,version text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),last_accessed_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
INSERT INTO storage.buckets VALUES('contract-documents','contract-documents',false,10485760,'{application/pdf}');
ALTER TABLE storage.buckets OWNER TO storage_admin_sim; ALTER TABLE storage.objects OWNER TO storage_admin_sim;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO propietario_sim,anon,authenticated,service_role;
GRANT SELECT ON storage.buckets,storage.objects TO propietario_sim;
GRANT ALL ON storage.objects TO anon,authenticated,service_role;`;
const PNG_MAGIC = Buffer.from('89504e470d0a1a0a', 'hex');
const png = (seed = randomUUID(), size = 200) => Buffer.concat([PNG_MAGIC, createHash('sha512').update(seed).digest(), Buffer.alloc(Math.max(size - 72, 0), 7)]);
const shaBytes = bytes => createHash('sha256').update(bytes).digest('hex');

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

test('07 no toca la etapa 1 protegida, documentos, plantilla ni Storage, y no usa users.persona_id', () => {
 const code = ESF.replace(/--[^\n]*/g, '');
 assert.doesNotMatch(code, /(INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE|TRUNCATE|ON)\s+storage\.|FOR (SHARE|UPDATE) OF o/i);
 assert.doesNotMatch(code, /(CREATE|ALTER|DROP)\s+POLICY/i);
 assert.doesNotMatch(code, /(CREATE( OR REPLACE)?|DROP)\s+FUNCTION\s+(public\.(iniciar|cancelar)_proceso_firma|firma_privada\.(proteger_evidencia|comprobar_transicion|proteger_documento|proteger_version_plantilla))/i);
 assert.doesNotMatch(code, /(INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE)\s+public\.(documentos_contrato|versiones_plantilla|plantillas)\b/i);
 assert.doesNotMatch(code, /users[^;\n]*persona_id|persona_id[^;\n]*public\.users/i);
 assert.doesNotMatch(code, /\bROLLBACK\b|session_replication_role|DISABLE TRIGGER/i);
 // Solo los CHECK de la etapa 1 se sustituyen, y el único SQL dinámico es el del instalador.
 assert.equal((code.match(/\bEXECUTE format\(/g) ?? []).length, 1);
});

test('07 no se instala sobre la firma autógrafa (04)', { skip: SKIP_AUTOGRAPH }, async () => {
 const db = await baseDb({ enums: false });
 try {
  await db.exec('SET ROLE propietario_sim');
  await db.exec(STAGE1);
  await db.exec(AUTOGRAPH);
  await assert.rejects(db.exec(ESF), /ya está instalada/);
 } finally { await db.close(); }
});

function suite(label, { enums }) {
 describe(`2C firma electrónica simple (${label})`, () => {
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
  // Cambios fuera de banda para simular el paso del tiempo: sin triggers.
  async function bypass(text, params = []) {
   await db.exec('SET session_replication_role=replica');
   try { return await db.query(text, params); } finally { await db.exec('SET session_replication_role=origin'); }
  }

  // ---------------------------------------------------------------- datos simulados
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

  // ---------------------------------------------------------------- servidor simulado
  const IP = '203.0.113.7'; const UA = 'Navegador de prueba';
  const newToken = () => randomBytes(32).toString('base64url');
  const otpHmac = (invitationId, otp) => createHmac('sha256', SECRET).update(`${invitationId}:${otp}`).digest('hex');
  const one = async (sql, params) => (await service(() => rows(sql, params)))[0].r;
  async function invite(p, signerId, { token = newToken(), hours = 72, actor = ids.admin } = {}) {
   const out = await one('select emitir_invitacion_firma($1,$2,$3,$4,$5) r', [actor, p.processId, signerId, sha(token), hours]);
   return { token, hash: sha(token), id: out.invitacion_id, out, p, signerId };
  }
  const changeEmail = (p, signerId, email, reason = 'El firmante cambió de correo', actor = ids.admin) =>
   one('select cambiar_correo_firmante($1,$2,$3,$4,$5) r', [actor, p.processId, signerId, email, reason]);
  const open = inv => one('select abrir_invitacion_firma($1,$2,$3) r', [inv.hash, IP, UA]);
  const view = (inv, hash = inv.p.pdfSha) => one('select registrar_visualizacion_firma($1,$2,$3,$4) r', [inv.hash, hash, IP, UA]);
  const consent = (inv, { hash = inv.p.pdfSha, version = CONSENT, accept = true } = {}) => one('select registrar_consentimiento_firma($1,$2,$3,$4,$5,$6) r', [inv.hash, hash, version, accept, IP, UA]);
  const sendOtp = (inv, code = '123456') => one('select emitir_otp_firma($1,$2,$3,$4) r', [inv.hash, otpHmac(inv.id, code), IP, UA]);
  const signWith = (inv, code = '123456', hash = inv.p.pdfSha, { image = png(), imageHash = shaBytes(image), confirm = true } = {}) =>
   one('select firmar_documento_electronico($1,$2,$3,$4,$5,$6,$7,$8) r', [inv.hash, otpHmac(inv.id, code), hash, Buffer.from(image).toString('base64'), imageHash, confirm, IP, UA]);
  // Servidor simulado tras la última firma: pide los datos, sube el PDF (service_role, como la API de Storage) y lo registra.
  const pdfData = p => one('select datos_pdf_final_firma($1) r', [p.processId]);
  const putObject = (path, { bytes = 8192, mime = 'application/pdf' } = {}) => service(() => db.query("insert into storage.objects(bucket_id,name,metadata) values('contract-documents',$1,$2::jsonb)",
   [path, JSON.stringify({ size: bytes, mimetype: mime, eTag: `"${randomUUID()}"` })]));
  const registerPdf = (p, { origin = p.pdfSha, manifest, hash, bytes = 8192, generator = 'generador-prueba' }) =>
   one('select registrar_pdf_final_firma($1,$2,$3,$4,$5,$6) r', [p.processId, origin, manifest, hash, bytes, generator]);
  async function finalize(p, { hash = sha('final-' + randomUUID()), bytes = 8192 } = {}) {
   const data = await pdfData(p);
   await putObject(data.ruta_pdf_final, { bytes });
   const out = await registerPdf(p, { manifest: data.sha256_manifiesto, hash, bytes });
   return { ...out, hash, data };
  }
  async function ready(p, signerId, options) {
   const inv = await invite(p, signerId, options);
   await view(inv); await consent(inv); await sendOtp(inv);
   return inv;
  }
  async function signOne(p, signerId, options) {
   const inv = await ready(p, signerId, options);
   const result = await signWith(inv);
   assert.equal(result.resultado, 'FIRMADO');
   return { inv, result };
  }
  const signAll = async p => { for (const s of p.signers) await signOne(p, s.id); };
  const annul = (p, { reason = 'El fiador se negó a firmar el contrato', dest = 'BORRADOR', sub = ids.admin } = {}) =>
   admin(() => db.query('select anular_proceso_firma($1,$2,$3)', [p.processId, reason, dest]), sub);
  const cancel = (p, reason = 'Datos erróneos') => admin(() => db.query('select cancelar_proceso_firma($1,$2)', [p.processId, reason]));
  const contractState = async id => (await rows('select estado::text e from contratos where id=$1', [id]))[0].e;
  const processRow = async id => (await rows('select * from procesos_firma where id=$1', [id]))[0];
  const signerStates = async id => (await rows('select estado from firmantes_proceso where proceso_firma_id=$1 order by rol', [id])).map(r => r.estado);
  const priv = async (sql, params) => (await owner(() => rows(sql, params)));
  const otps = inv => priv('select * from firma_privada.otps_firma where invitacion_id=$1 order by emitido_at', [inv.id]);
  const invitation = async inv => (await priv('select * from firma_privada.invitaciones_firma where id=$1', [inv.id]))[0];
  const events = async inv => (await priv('select tipo from firma_privada.eventos_firma where invitacion_id=$1 order by ocurrido_at,id', [inv.id])).map(r => r.tipo);
  const allowResend = inv => bypass("update firma_privada.otps_firma set emitido_at=emitido_at-interval '2 minutes',expira_at=expira_at-interval '2 minutes' where invitacion_id=$1", [inv.id]);
  const INVALID = err => err.code === 'RF001';

  before(async () => {
   db = await baseDb({ enums });
   await owner(() => db.exec(STAGE1));
   await db.query("insert into versiones_plantilla values($1,$2,2,'BORRADOR',$3)", [ids.v2, ids.template, HTML_V2]);
   await owner(() => db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,$3::jsonb,'Aprobación jurídica de prueba')", [ids.v2, sha(HTML_V2), JSON.stringify(COVERAGE)]));
   await db.query('update personas set correo=$1 where id=$2', [EMAILS.ARRENDADOR, ids.rep]);
   await db.query('update personas set correo=$1 where id=$2', [EMAILS.ARRENDATARIO, ids.tenant]);
   await db.query('update personas set correo=$1 where id=$2', [EMAILS.FIADOR, ids.guarantor]);
   // Un proceso PENDIENTE de la etapa 1 sobrevive a la instalación y solo sale por cancelación.
   legacy = await pending();
   // Preflight: rechaza una etapa 1 modificada o con CHECK distintos, sin dejar cambios.
   await db.exec('BEGIN');
   await owner(() => db.exec("CREATE OR REPLACE FUNCTION firma_privada.proteger_evidencia() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RETURN NEW; END $$"));
   await assert.rejects(owner(() => db.exec(ESF)), /proteger_evidencia\(\) no coincide con la etapa 1/);
   await abort();
   await db.exec('BEGIN');
   await owner(() => db.exec("ALTER TABLE public.procesos_firma ADD CONSTRAINT extra CHECK(estado<>'CANCELADO' OR motivo_cancelacion IS NOT NULL)"));
   await assert.rejects(owner(() => db.exec(ESF)), /CHECK de procesos_firma no son los de la etapa 1/);
   await abort();
   // Sin lectura de storage.objects, o con el bucket público: aborta sin cambios.
   await db.exec('BEGIN; REVOKE SELECT ON storage.objects FROM propietario_sim;');
   await assert.rejects(owner(() => db.exec(ESF)), /no puede leer storage.objects/);
   await abort();
   await db.exec("BEGIN; UPDATE storage.buckets SET public=true WHERE id='contract-documents';");
   await assert.rejects(owner(() => db.exec(ESF)), /no existe o no es privado/);
   await abort();
   await owner(() => db.exec(ESF));
  });
  after(async () => db.close());

  // ---------------------------------------------------------------- instalación y privilegios
  test('instalación: no se reinstala, la firma autógrafa (04) queda excluida y la etapa 1 protegida no cambia', async () => {
   await assert.rejects(owner(() => db.exec(ESF)), /ya está instalada|no coincide con la etapa 1/); await abort();
   if (AUTOGRAPH) { await assert.rejects(owner(() => db.exec(AUTOGRAPH)), /ya está instalada/); await abort(); }
   const fns = await rows(`select p.oid::regprocedure::text fn,md5(replace(prosrc,E'\\r','')) h from pg_proc p where p.oid in(
    'public.iniciar_proceso_firma(uuid,uuid,text,uuid)'::regprocedure,'public.cancelar_proceso_firma(uuid,text)'::regprocedure,
    'firma_privada.proteger_evidencia()'::regprocedure,'firma_privada.comprobar_transicion()'::regprocedure)`);
   assert.deepEqual(Object.fromEntries(fns.map(f => [f.fn, f.h])), {
    'iniciar_proceso_firma(uuid,uuid,text,uuid)': 'aeac70b77e73f3d2eea5895e2641a52d', 'cancelar_proceso_firma(uuid,text)': 'ffd8733b8a332bd2990a0a21704ffdee',
    'firma_privada.proteger_evidencia()': 'b09124d8bed47a44e784473b1f8bc7d3', 'firma_privada.comprobar_transicion()': '4ea2e0df939a094d47a4635548416fec',
   });
  });

  test('una instalación que falla no deja nada', async () => {
   const fresh = await baseDb({ enums: false });
   try {
    await fresh.exec('set role propietario_sim'); await fresh.exec(STAGE1); await fresh.exec('reset role');
    await fresh.exec('BEGIN; GRANT propietario_sim TO authenticated;');
    await fresh.exec('set role propietario_sim');
    await assert.rejects(fresh.exec(ESF), /rol cliente es miembro/);
    await fresh.exec('ROLLBACK'); await fresh.exec('reset role');
    assert.equal((await fresh.query("select to_regclass('firma_privada.invitaciones_firma') t")).rows[0].t, null);
   } finally { await fresh.close(); }
  });

  test('sin acceso de clientes: tablas privadas cerradas, cada RPC para su rol y funciones endurecidas', async () => {
   const can = async (role, fn) => (await rows("select has_function_privilege($1,$2,'EXECUTE') ok", [role, fn]))[0].ok;
   for (const fn of SERVICE_RPCS) assert.deepEqual([await can('service_role', fn), await can('authenticated', fn), await can('anon', fn)], [true, false, false], fn);
   for (const fn of ADMIN_RPCS) assert.deepEqual([await can('authenticated', fn), await can('service_role', fn), await can('anon', fn)], [true, false, false], fn);
   for (const table of PRIVATE_TABLES) for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await rows("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') p", [role, table]))[0].p, false, `${role} ${table}`);
   }
   assert.equal((await rows("select has_schema_privilege('service_role','firma_privada','USAGE') u"))[0].u, false);
   const privateFns = await rows("select p.oid::regprocedure::text fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='firma_privada'");
   assert.ok(privateFns.length > 15);
   for (const { fn } of privateFns) for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await can(role, fn), false, `${role} ${fn}`);
   for (const fn of [...SERVICE_RPCS, ...ADMIN_RPCS]) {
    const f = (await rows('select prosecdef,proconfig,prosrc from pg_proc where oid=$1::regprocedure', [fn]))[0];
    assert.equal(f.prosecdef, true, fn);
    assert.ok(f.proconfig.some(c => /^search_path=(""|)$/.test(c)), `${fn} sin search_path vacío`);
    assert.doesNotMatch(f.prosrc, /\bEXECUTE\b/i, fn);
   }
  });

  // ---------------------------------------------------------------- caso válido
  test('flujo completo: tres firmantes con firma dibujada, PDF final registrado y cierre automático', async () => {
   const p = await pending();
   assert.equal((await processRow(p.processId)).metodo, 'ELECTRONICA_SIMPLE');
   const documentBefore = (await rows('select * from documentos_contrato where id=$1', [p.documentId]))[0];
   let pendingCount = p.signers.length;
   for (const s of p.signers) {
    const inv = await invite(p, s.id);
    assert.equal(inv.out.correo, EMAILS[s.rol], 'va al correo congelado');
    const opened = await open(inv);
    assert.equal(opened.sha256_documento, p.pdfSha);
    assert.match(opened.correo_parcial, /^.{2}\*\*\*@example\.com$/);
    assert.equal(opened.visualizado, false);
    assert.ok(opened.consentimiento_texto.includes(p.pdfSha));
    assert.ok(!JSON.stringify(opened).includes(inv.hash));
    await view(inv);
    const consentId = await consent(inv);
    assert.equal(await consent(inv), consentId, 'reintento idempotente');
    assert.equal((await sendOtp(inv)).correo, EMAILS[s.rol]);
    const result = await signWith(inv);
    pendingCount -= 1;
    assert.equal(result.resultado, 'FIRMADO');
    assert.equal(result.firmantes_pendientes, pendingCount);
    assert.equal(result.pdf_final_requerido, pendingCount === 0);
    assert.deepEqual(await events(inv), ['INVITACION_EMITIDA', 'INVITACION_ABIERTA', 'DOCUMENTO_VISUALIZADO', 'CONSENTIMIENTO_OTORGADO', 'OTP_EMITIDO', 'FIRMA_REGISTRADA']);
   }
   assert.deepEqual(await signerStates(p.processId), ['FIRMADO', 'FIRMADO', 'FIRMADO']);
   // Con todas las firmas, el contrato sigue pendiente hasta registrar el PDF final.
   assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
   const final = await finalize(p);
   assert.equal(final.ya_registrado, false);
   const evidence = await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId]);
   assert.equal(evidence.firmas.length, 3);
   for (const firma of evidence.firmas) {
    assert.equal(firma.sha256_documento, p.pdfSha);
    assert.equal(firma.ip, IP); assert.equal(firma.user_agent, UA);
    assert.match(firma.sha256_firma, /^[0-9a-f]{64}$/); assert.match(firma.sha256_evidencia, /^[0-9a-f]{64}$/);
    assert.equal(firma.firma_png, undefined, 'la consulta general no devuelve la imagen');
    const c = evidence.consentimientos.find(x => x.id === firma.consentimiento_id);
    assert.equal(c.sha256_documento, p.pdfSha);
    assert.ok(c.texto.includes(p.pdfSha));
    assert.equal(evidence.eventos.find(e => e.id === c.visualizacion_id).tipo, 'DOCUMENTO_VISUALIZADO');
   }
   const process = await processRow(p.processId);
   assert.equal(process.estado, 'COMPLETADO');
   assert.ok(process.completado_at);
   assert.deepEqual([process.pdf_final_id, process.sha256_documento_firmado], [final.pdf_final_id, final.hash]);
   assert.equal(process.sha256_documento_origen, p.pdfSha);
   assert.equal((await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId])).pdf_final.sha256, final.hash);
   assert.equal(await contractState(p.contractId), 'FIRMADO');
   assert.deepEqual((await rows('select * from documentos_contrato where id=$1', [p.documentId]))[0], documentBefore, 'el documento no cambia');
   await assert.rejects(annul(p), /no pendiente/);
   await assert.rejects(cancel(p), /no pendiente/);
   await assert.rejects(owner(() => db.query("update contratos set estado='BORRADOR' where id=$1", [p.contractId])), /no permitida/);
   await owner(() => db.query("update contratos set estado='ACTIVO' where id=$1", [p.contractId]));
  });

  // ---------------------------------------------------------------- consentimiento V2
  const consentDoc = () => read('../docs/firmas-2c-consentimiento-firma-dibujada.md');

  test('consentimiento V2: el texto de 07 es el documentado, cubre lo aprobado y no afirma validez ni equivalencia', async () => {
   const { texto } = (await priv("select firma_privada.texto_consentimiento_v2('{nombre}','{calidad}','{folio}','{hash}','{correo}') texto"))[0];
   assert.ok(consentDoc().includes(`\`\`\`text\n${texto}\n\`\`\``), 'el documento lleva el texto exacto');
   assert.match(consentDoc(), /PENDIENTE DE REVISIÓN JURÍDICA/);
   for (const required of [/Acepto firmar este contrato por medios electrónicos/, /Dibujaré mi firma en pantalla y la confirmaré/, /código de un solo uso que se enviará a \{correo\}/,
    /se conserven el documento, mi firma dibujada y las evidencias electrónicas/, /Al completar la firma, acepto expresamente su contenido/]) assert.match(texto, required);
   assert.doesNotMatch(texto, /autógraf|equivalen|válid|validez|garantiz|constituye|dibujé|enviado a/i);
   assert.doesNotMatch(texto, /\r/);
  });

  test('calidad del firmante: valores cerrados traducidos, carácter libre intacto y nunca decide el derecho propio', async () => {
   const calidad = async (tipo, caracter, rol = 'ARRENDADOR') => (await priv('select firma_privada.calidad_firmante($1,$2,$3,$4) c', [tipo, caracter, 'Empresa SA de CV', rol]))[0].c;
   for (const [rol, text] of [['ARRENDADOR', 'parte arrendadora'], ['ARRENDATARIO', 'parte arrendataria'], ['FIADOR', 'parte fiadora'], ['OBLIGADO_SOLIDARIO', 'parte obligada solidaria'], ['REPRESENTANTE_LEGAL', 'representante legal']]) {
    assert.equal(await calidad('PERSONA', 'POR_DERECHO_PROPIO', rol), `por mi propio derecho, como ${text}`);
   }
   for (const [caracter, text] of [['REPRESENTANTE_LEGAL', 'en mi carácter de representante legal de'], ['APODERADO_LEGAL', 'en mi carácter de apoderado legal de'], ['ADMINISTRADOR', 'en mi carácter de administrador de'], ['OTRO', 'en representación de']])
    assert.equal(await calidad('PERSONA_MORAL', caracter), `${text} Empresa SA de CV, como parte arrendadora`);
   // El catálogo real de la aplicación: un código nuevo sin redacción propia no puede llegar al texto visible.
   for (const code of Object.keys(representativeCharacters)) {
    const shown = await calidad('PERSONA_MORAL', code);
    assert.ok(!shown.includes(code), code); assert.ok(!shown.includes('_'), code); assert.ok(!shown.includes('«'), code);
   }
   assert.doesNotMatch(await calidad('PERSONA_MORAL', 'OTRO'), /carácter|apoderad|administrador|representante legal/i, 'OTRO no atribuye facultades');
   // Texto libre: exactamente como se capturó, incluidas mayúsculas y acentos.
   for (const free of ['Apoderado General', 'APODERADO', 'apoderado general', 'otro', 'Otro', 'Administrador Único', 'REPRESENTANTE LEGAL', 'Apoderada; poder 123/2024'])
    assert.equal(await calidad('PERSONA_MORAL', free), `en representación de Empresa SA de CV, con el carácter registrado de «${free}», como parte arrendadora`);
   // Con forma de código: sin etiqueta inventada y sin mostrar el código. Una persona moral nunca actúa "por derecho propio" por lo que diga el texto.
   for (const code of ['APODERADO_ESPECIAL', 'apoderado_legal', 'POR_DERECHO_PROPIO', 'representante_legal', 'OTRO_VALOR'])
    assert.equal(await calidad('PERSONA_MORAL', code), 'en representación de Empresa SA de CV, como parte arrendadora');
   // Un rol fuera de la lista cerrada no produce texto: consentir falla en vez de mostrar el código.
   assert.equal(await calidad('PERSONA', 'POR_DERECHO_PROPIO', 'OTRO_ROL'), null);
  });

  test('la vista previa del administrador coincide con el texto que genera 07', async () => {
   const catalog = representativeCharacters;
   for (const role of ['ARRENDADOR', 'ARRENDATARIO', 'FIADOR', 'OBLIGADO_SOLIDARIO', 'REPRESENTANTE_LEGAL'])
    for (const character of [...Object.keys(catalog), 'Apoderado General', 'apoderado_legal', 'Administrador Único', '  Con   espacios  ']) {
     const frozen = (await priv('select firma_privada.texto($1) t', [character]))[0].t;
     const sqlText = (await priv('select firma_privada.calidad_firmante($1,$2,$3,$4) c', ['PERSONA_MORAL', frozen, 'Empresa SA de CV', role]))[0].c;
     assert.equal(representationQuality(character, 'Empresa SA de CV', role), sqlText, `${character} / ${role}`);
    }
   const review = caracter => reviewRepresentation({ company: 'Empresa', role: 'ARRENDADOR', representatives: [{ caracter }], catalog });
   for (const value of ['REPRESENTANTE_LEGAL', 'APODERADO_LEGAL', 'ADMINISTRADOR']) assert.equal(review(value).status, 'ok', value);
   assert.equal(review('OTRO').status, 'warning'); assert.match(review('OTRO').message, /no indicará un carácter específico/); assert.ok(!review('OTRO').message.includes('OTRO'));
   for (const value of [null, '', '  ', 'null', 'Apoderado General']) { assert.equal(review(value).status, 'blocking', String(value)); assert.equal(review(value).quality, null); }
   assert.equal(reviewRepresentation({ company: 'E', role: 'ARRENDADOR', representatives: [], catalog }).status, 'blocking');
   assert.equal(reviewRepresentation({ company: 'E', role: 'ARRENDADOR', representatives: [{ caracter: 'OTRO' }, { caracter: 'OTRO' }], catalog }).status, 'blocking');
  });

  test('correo enmascarado: nunca revela la parte local completa', async () => {
   for (const [mail, masked] of [['representante@example.com', 're***@example.com'], ['abc@example.com', 'ab***@example.com'], ['ab@example.com', 'a***@example.com'], ['a@example.com', 'a***@example.com']])
    assert.equal((await priv('select firma_privada.correo_enmascarado($1) c', [mail]))[0].c, masked);
  });

  test('versiones: V1 se conserva sin cambios pero ya no se acepta; se guarda V2 con el texto mostrado, y su hash entra en la evidencia', async () => {
   const v1 = (await priv("select firma_privada.texto_consentimiento('CONSENTIMIENTO_FES_V1','Ana','POR_DERECHO_PROPIO','ARRENDATARIO','CTR-1','hash','a@example.com') t"))[0].t;
   assert.equal(v1, 'Yo, Ana, con el carácter de POR_DERECHO_PROPIO y como ARRENDATARIO, declaro que revisé el documento PDF del contrato CTR-1, identificado con la huella SHA-256 hash; que acepto firmarlo por medios electrónicos; y que el código de un solo uso enviado a a@example.com, junto con este registro, constituye mi firma electrónica sobre exactamente ese documento.');
   const p = await pending();
   for (const s of p.signers) {
    const inv = await invite(p, s.id);
    const opened = await open(inv);
    assert.equal(opened.consentimiento_version, 'CONSENTIMIENTO_FES_V2');
    const shown = opened.consentimiento_texto;
    assert.ok(!shown.includes(EMAILS[s.rol]), 'sin correo completo'); assert.ok(shown.includes(opened.correo_parcial));
    assert.doesNotMatch(shown, /[A-Z]+_[A-Z]+/, 'sin valores técnicos');
    assert.ok(shown.includes(p.pdfSha));
    await view(inv);
    await assert.rejects(consent(inv, { version: 'CONSENTIMIENTO_FES_V1' }), /no vigente/);
    await consent(inv);
    const [stored] = await priv('select * from firma_privada.consentimientos_firma where invitacion_id=$1', [inv.id]);
    assert.equal(stored.version, 'CONSENTIMIENTO_FES_V2');
    assert.equal(stored.texto, shown, 'lo guardado es exactamente lo mostrado');
    assert.equal((await priv('select correo from firma_privada.invitaciones_firma where id=$1', [inv.id]))[0].correo, EMAILS[s.rol], 'el correo completo sigue en la evidencia');
    await sendOtp(inv);
    const signed = await signWith(inv);
    assert.equal(signed.resultado, 'FIRMADO');
    const [firma] = await priv('select * from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]);
    assert.equal(firma.correo, EMAILS[s.rol]);
    const recomputed = (await priv("select firma_privada.sha256_texto(concat_ws('|','EVIDENCIA_FES_V1',f.id,f.proceso_firma_id,f.firmante_id,f.invitacion_id,f.consentimiento_id,$2::text,f.otp_id,f.persona_firmante_id,f.correo,f.sha256_documento,f.sha256_firma,firma_privada.utc_texto(f.firmado_at))) h from firma_privada.firmas_electronicas f where f.id=$1", [firma.id, sha(shown)]))[0].h;
    assert.equal(firma.sha256_evidencia, recomputed, 'la evidencia firmada incluye el hash del texto mostrado');
   }
  });

  test('cada valor del catálogo, en un proceso real: texto correcto sin códigos, lo guardado es lo mostrado y el correo completo sigue en la evidencia', async () => {
   const expected = { REPRESENTANTE_LEGAL: 'en mi carácter de representante legal de', APODERADO_LEGAL: 'en mi carácter de apoderado legal de', ADMINISTRADOR: 'en mi carácter de administrador de', OTRO: 'en representación de' };
   assert.deepEqual(Object.keys(expected).sort(), Object.keys(representativeCharacters).sort(), 'la prueba cubre todo el catálogo');
   const [rep] = await rows('select id,caracter from representantes_persona_moral where persona_moral_id=$1 and es_principal', [ids.company]);
   try {
    for (const [code, phrase] of Object.entries(expected)) {
     await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, code]);
     const p = await pending();
     const landlord = p.signers.find(s => s.rol === 'ARRENDADOR');
     assert.equal(landlord.caracter ?? (await rows('select caracter from firmantes_proceso where id=$1', [landlord.id]))[0].caracter, code, 'el código se congela sin cambios');
     const inv = await invite(p, landlord.id);
     const opened = await open(inv);
     const shown = opened.consentimiento_texto;
     assert.match(shown, new RegExp(`^Yo, .+, ${phrase} .+, como parte arrendadora, manifiesto`), code);
     assert.ok(!shown.includes(code), code); assert.doesNotMatch(shown, /[A-Z]+_[A-Z]+/); assert.ok(!shown.includes('«'), code);
     assert.ok(!shown.includes(EMAILS.ARRENDADOR)); assert.ok(shown.includes(opened.correo_parcial));
     await view(inv); await consent(inv); await sendOtp(inv);
     const [stored] = await priv('select * from firma_privada.consentimientos_firma where invitacion_id=$1', [inv.id]);
     assert.equal(stored.texto, shown, code); assert.equal(stored.version, CONSENT);
     assert.equal((await signWith(inv)).resultado, 'FIRMADO');
     const [firma] = await priv('select * from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]);
     assert.equal(firma.correo, EMAILS.ARRENDADOR, 'el correo completo sigue en la evidencia');
     const recomputed = (await priv("select firma_privada.sha256_texto(concat_ws('|','EVIDENCIA_FES_V1',f.id,f.proceso_firma_id,f.firmante_id,f.invitacion_id,f.consentimiento_id,$2::text,f.otp_id,f.persona_firmante_id,f.correo,f.sha256_documento,f.sha256_firma,firma_privada.utc_texto(f.firmado_at))) h from firma_privada.firmas_electronicas f where f.id=$1", [firma.id, sha(shown)]))[0].h;
     assert.equal(firma.sha256_evidencia, recomputed, code);
    }
   } finally { await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, rep.caracter]); }
  });

  test('un carácter de texto libre real llega intacto al texto del firmante', async () => {
   const [rep] = await rows('select id,caracter from representantes_persona_moral where persona_moral_id=$1 and es_principal', [ids.company]);
   await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, 'Apoderado General']);
   try {
    const p = await pending();
    const landlord = p.signers.find(s => s.rol === 'ARRENDADOR');
    assert.match((await open(await invite(p, landlord.id))).consentimiento_texto, /, en representación de .+, con el carácter registrado de «Apoderado General», como parte arrendadora, manifiesto/);
   } finally { await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, rep.caracter]); }
  });

  test('sin fiador firman arrendador y arrendatario; el representante firma por la persona moral', async () => {
   const p = await pending({ guarantor: false });
   assert.deepEqual(p.signers.map(s => s.rol), ['ARRENDADOR', 'ARRENDATARIO']);
   const landlord = p.signers.find(s => s.rol === 'ARRENDADOR');
   const { inv } = await signOne(p, landlord.id);
   const firma = (await priv('select * from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]))[0];
   assert.equal(firma.persona_firmante_id, ids.rep);
   assert.equal(firma.nombre_firmante, 'Manuel Pérez Ruiz');
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   await signOne(p, p.signers.find(s => s.rol === 'ARRENDATARIO').id);
   await finalize(p);
   assert.equal(await contractState(p.contractId), 'FIRMADO');
  });

  // ---------------------------------------------------------------- identidad
  test('identidad: no depende de cuentas de usuario ni de users.persona_id', async () => {
   // Una cuenta que afirma ser otra persona no altera quién firma, y el firmante no necesita cuenta.
   await db.exec('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS persona_id uuid');
   await db.query('update users set persona_id=$1', [ids.tenant]);
   try {
    const p = await pending();
    const guarantor = p.signers.find(s => s.rol === 'FIADOR');
    const { inv } = await signOne(p, guarantor.id);
    assert.equal((await priv('select persona_firmante_id p from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]))[0].p, ids.guarantor);
    assert.equal((await rows('select count(*)::int n from users where id=$1', [ids.guarantor]))[0].n, 0);
    assert.deepEqual((await rows("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','firma_privada') and p.prosrc ~ 'users[^;]*persona_id'")), []);
   } finally { await db.exec('ALTER TABLE public.users DROP COLUMN persona_id'); }
  });

  test('correo: la invitación usa el congelado y la RPC no acepta ningún otro', async () => {
   const p = await pending();
   for (const s of p.signers) assert.equal((await invite(p, s.id)).out.correo, EMAILS[s.rol]);
   await assert.rejects(service(() => db.query("select emitir_invitacion_firma($1,$2,$3,$4,$5,$6)", [ids.admin, p.processId, p.signers[0].id, 'otro@example.com', sha(newToken()), 72])), /does not exist|no existe/);
   // Normaliza el dato congelado sin modificarlo.
   const q = await pending();
   const signer = q.signers.find(s => s.rol === 'ARRENDATARIO');
   await bypass("update firmantes_proceso set snapshot=jsonb_set(snapshot,'{persona_firmante,correo}','\"  Inquilino@Example.COM \"') where id=$1", [signer.id]);
   assert.equal((await invite(q, signer.id)).out.correo, 'inquilino@example.com');
  });

  test('correo: sin uno congelado válido no se invita hasta registrar el cambio', async () => {
   const p = await pending();
   const [none, bad] = p.signers;
   await bypass("update firmantes_proceso set snapshot=snapshot#-'{persona_firmante,correo}' where id=$1", [none.id]);
   await bypass("update firmantes_proceso set snapshot=jsonb_set(snapshot,'{persona_firmante,correo}','\"sin-arroba\"') where id=$1", [bad.id]);
   await assert.rejects(invite(p, none.id), err => err.code === 'RF007');
   await assert.rejects(invite(p, bad.id), err => err.code === 'RF007');
   await changeEmail(p, none.id, 'capturado@example.com');
   assert.equal((await invite(p, none.id)).out.correo, 'capturado@example.com');
   const evidence = await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId]);
   assert.equal(evidence.cambios_correo[0].correo_anterior, null);
  });

  test('correo: el cambio es expreso, justificado, auditado y revoca la invitación viva', async () => {
   const p = await pending();
   const signer = p.signers.find(s => s.rol === 'FIADOR');
   const frozenBefore = (await rows('select snapshot from firmantes_proceso where id=$1', [signer.id]))[0].snapshot;
   const first = await ready(p, signer.id);
   for (const reason of [null, '', 'corta', 'x'.repeat(1001)]) await assert.rejects(changeEmail(p, signer.id, 'nuevo@example.com', reason), /Justificación obligatoria/);
   await assert.rejects(changeEmail(p, signer.id, 'sin-arroba'), /Correo inválido/);
   await assert.rejects(changeEmail(p, signer.id, ` ${EMAILS.FIADOR.toUpperCase()} `), /ya es el correo vigente/);
   await assert.rejects(changeEmail(p, signer.id, 'nuevo@example.com', 'El firmante cambió de correo', ids.user), err => err.code === '42501');
   assert.equal((await invitation(first)).revocada_at, null, 'los rechazos no cambian nada');
   const changed = await changeEmail(p, signer.id, '  Nuevo@Example.COM ');
   assert.deepEqual([changed.correo, changed.invitacion_revocada], ['nuevo@example.com', true]);
   // El enlace y el OTP de la dirección anterior dejan de valer, y el dato congelado no se toca.
   assert.equal((await invitation(first)).motivo_revocacion, 'Cambio de correo del firmante');
   await assert.rejects(signWith(first), INVALID);
   assert.deepEqual((await rows('select snapshot from firmantes_proceso where id=$1', [signer.id]))[0].snapshot, frozenBefore);
   const second = await ready(p, signer.id);
   assert.equal(second.out.correo, 'nuevo@example.com');
   const reopened = (await open(second)).consentimiento_texto;
   assert.ok(reopened.includes('nu***@example.com')); assert.ok(!reopened.includes('nuevo@example.com'), 'el texto lleva el correo enmascarado');
   assert.equal((await signWith(second)).resultado, 'FIRMADO');
   const firma = (await priv('select correo from firma_privada.firmas_electronicas where invitacion_id=$1', [second.id]))[0];
   assert.equal(firma.correo, 'nuevo@example.com');
   const [audit] = (await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId])).cambios_correo;
   assert.deepEqual([audit.correo_anterior, audit.correo_nuevo, audit.justificacion, audit.cambiado_por], [EMAILS.FIADOR, 'nuevo@example.com', 'El firmante cambió de correo', ids.admin]);
   assert.ok((await events(first)).includes('INVITACION_REVOCADA'));
   // Ya firmado no se cambia; el propietario no reescribe el registro ni dirige una invitación a otra dirección.
   await assert.rejects(changeEmail(p, signer.id, 'otro@example.com'), /ya firmó/);
   await assert.rejects(owner(() => db.query("update firma_privada.cambios_correo_firmante set justificacion='Reescrita por el propietario'")), /inmutable/);
   await assert.rejects(owner(() => db.query('delete from firma_privada.cambios_correo_firmante')), /inmutable/);
   const other = p.signers.find(s => s.rol === 'ARRENDATARIO');
   await assert.rejects(owner(() => db.query("insert into firma_privada.invitaciones_firma(proceso_firma_id,firmante_id,token_hash,correo,emitida_por,emitida_at,expira_at) values($1,$2,$3,'atacante@example.com',$4,now(),now()+interval '1 hour')", [p.processId, other.id, sha(newToken()), ids.admin])), /inconsistente/);
   // Firmante de otro proceso y proceso cerrado.
   const q = await pending();
   await assert.rejects(changeEmail(p, q.signers[0].id, 'nuevo@example.com'), /ajeno al proceso/);
   await cancel(q);
   await assert.rejects(changeEmail(q, q.signers[0].id, 'nuevo@example.com'), /no pendiente/);
  });

  // ---------------------------------------------------------------- token
  test('token: solo se guarda su hash; caducidad, revocación, sustitución y uso único', async () => {
   const p = await pending();
   const [a, b, c] = p.signers;
   // El token nunca llega a la base, en ninguna tabla.
   const inv = await invite(p, a.id);
   const dump = JSON.stringify(await priv("select to_jsonb(i) j from firma_privada.invitaciones_firma i where id=$1", [inv.id]));
   assert.ok(!dump.includes(inv.token));
   assert.ok(dump.includes(inv.hash));
   const raw = await one('select abrir_invitacion_firma($1) r', [inv.hash]);
   assert.ok(raw.invitacion_id);
   await assert.rejects(service(() => rows('select abrir_invitacion_firma($1)', [inv.token])), INVALID, 'el token en claro no sirve como hash');
   await assert.rejects(service(() => rows('select abrir_invitacion_firma($1)', [sha(newToken())])), INVALID);
   await assert.rejects(invite(p, b.id, { token: inv.token }), /llave duplicada|duplicate key|unique/i);
   await assert.rejects(service(() => rows('select emitir_invitacion_firma($1,$2,$3,$4)', [ids.admin, p.processId, b.id, 'corto'])), /Hash de token/);
   for (const hours of [0, 169]) await assert.rejects(invite(p, b.id, { hours }), /Vigencia/);

   // Caducidad.
   const expiring = await invite(p, b.id);
   await bypass("update firma_privada.invitaciones_firma set emitida_at=emitida_at-interval '4 days',expira_at=now()-interval '1 second' where id=$1", [expiring.id]);
   await assert.rejects(open(expiring), INVALID);
   await assert.rejects(view(expiring), INVALID);

   // Sustitución: la invitación anterior muere y la nueva funciona.
   const replacement = await invite(p, b.id);
   assert.ok((await invitation(expiring)).revocada_at);
   await assert.rejects(open(expiring), INVALID);
   assert.ok((await open(replacement)).invitacion_id);

   // Revocación.
   const revoked = await invite(p, c.id);
   await service(() => db.query('select revocar_invitacion_firma($1,$2,$3)', [ids.admin, revoked.id, 'Correo equivocado']));
   await assert.rejects(open(revoked), INVALID);
   await assert.rejects(service(() => db.query('select revocar_invitacion_firma($1,$2,$3)', [ids.admin, revoked.id, 'Otra vez'])), /ya se usó o ya está revocada/);
   await assert.rejects(service(() => db.query('select revocar_invitacion_firma($1,$2,$3)', [ids.user, inv.id, 'No admin'])), err => err.code === '42501');

   // Uso único: tras firmar, el token no sirve para nada y no se puede reinvitar.
   await view(inv); await consent(inv); await sendOtp(inv);
   assert.equal((await signWith(inv)).resultado, 'FIRMADO');
   for (const step of [() => open(inv), () => view(inv), () => consent(inv), () => sendOtp(inv, '000000'), () => signWith(inv)]) await assert.rejects(step(), INVALID);
   await assert.rejects(invite(p, a.id), /ya firmó/);
   await assert.rejects(service(() => db.query('select revocar_invitacion_firma($1,$2,$3)', [ids.admin, inv.id, 'Tarde'])), /ya se usó/);
   assert.ok((await invitation(inv)).usada_at);
  });

  test('invitaciones: solo para administradores y firmantes del proceso', async () => {
   const p = await pending(); const q = await pending();
   await assert.rejects(invite(p, p.signers[0].id, { actor: ids.user }), err => err.code === '42501');
   await assert.rejects(invite(p, q.signers[0].id), /ajeno al proceso/);
  });

  // ---------------------------------------------------------------- OTP
  test('OTP: secreto del servidor, intentos persistentes y bloqueo al quinto fallo', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   const [stored] = await otps(inv);
   assert.equal(stored.otp_hmac, otpHmac(inv.id, '123456'));
   // Sin el secreto no se reproduce el valor guardado, y un código no se puede comprobar por fuerza bruta local.
   assert.notEqual(stored.otp_hmac, sha(`${inv.id}:123456`));
   assert.notEqual(stored.otp_hmac, createHmac('sha256', 'otro-secreto').update(`${inv.id}:123456`).digest('hex'));
   assert.ok(!JSON.stringify(await priv('select to_jsonb(o) j from firma_privada.otps_firma o where invitacion_id=$1', [inv.id])).includes('"123456"'));
   for (let attempt = 1; attempt <= 4; attempt++) {
    assert.deepEqual(await signWith(inv, '000000'), { resultado: 'OTP_INCORRECTO', intentos_restantes: 5 - attempt });
    // El contador sobrevive: la RPC no lanza excepción, así que la transacción confirma.
    assert.equal((await otps(inv))[0].intentos, attempt);
   }
   assert.deepEqual(await signWith(inv, '000000'), { resultado: 'OTP_AGOTADO', intentos_restantes: 0 });
   const [closed] = await otps(inv);
   assert.deepEqual([closed.intentos, closed.motivo_invalidacion], [5, 'AGOTADO']);
   // Ni el código correcto sirve ya.
   assert.deepEqual(await signWith(inv), { resultado: 'OTP_INEXISTENTE', intentos_restantes: 0 });
   assert.deepEqual(await signerStates(p.processId), ['PENDIENTE', 'PENDIENTE', 'PENDIENTE']);
   const log = await events(inv);
   assert.equal(log.filter(t => t === 'OTP_FALLIDO').length, 4);
   assert.ok(log.includes('OTP_AGOTADO'));
  });

  test('OTP: vencimiento, invalidación al reenviar, espera de 60 s y máximo de 5 códigos', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   // Espera entre envíos: el rechazo no cambia nada.
   await assert.rejects(sendOtp(inv, '222222'), err => err.code === 'RF005');
   assert.equal((await otps(inv)).length, 1);
   // Reenvío: el anterior deja de valer, aunque siga vigente, y los intentos no se heredan.
   assert.equal((await signWith(inv, '000000')).resultado, 'OTP_INCORRECTO');
   await allowResend(inv);
   const second = await sendOtp(inv, '222222');
   assert.equal(second.codigos_restantes, 3);
   const list = await otps(inv);
   assert.deepEqual(list.map(o => o.motivo_invalidacion), ['REENVIO', null]);
   assert.deepEqual(list.map(o => o.intentos), [1, 0]);
   assert.equal((await signWith(inv, '123456')).resultado, 'OTP_INCORRECTO');
   // Vencimiento: se cierra y el código correcto ya no firma.
   await bypass("update firma_privada.otps_firma set emitido_at=now()-interval '11 minutes',expira_at=now()-interval '1 minute' where invitacion_id=$1 and invalidado_at is null", [inv.id]);
   assert.equal((await signWith(inv, '222222')).resultado, 'OTP_VENCIDO');
   assert.equal((await signWith(inv, '222222')).resultado, 'OTP_INEXISTENTE');
   // Tope por invitación: quinto código permitido, sexto no. Una invitación nueva vuelve a empezar desde el consentimiento.
   for (const code of ['333333', '444444', '555555']) { await allowResend(inv); await sendOtp(inv, code); }
   await allowResend(inv);
   await assert.rejects(sendOtp(inv, '666666'), err => err.code === 'RF004');
   assert.equal((await signWith(inv, '555555')).resultado, 'FIRMADO');
   assert.equal((await otps(inv)).at(-1).consumido_at !== null, true);
  });

  test('OTP: no se emite sin consentimiento y un código de otra invitación no firma', async () => {
   const p = await pending();
   const [a, b] = p.signers;
   const inv = await invite(p, a.id);
   await view(inv);
   await assert.rejects(sendOtp(inv), err => err.code === 'RF003');
   await assert.rejects(service(() => rows('select emitir_otp_firma($1,$2)', [inv.hash, '123456'])), /HMAC de OTP/);
   const other = await ready(p, b.id);
   await consent(inv); await sendOtp(inv, '999999');
   // Mismo código en otra invitación: el HMAC incluye el id de la invitación.
   const image = png();
   assert.equal((await one('select firmar_documento_electronico($1,$2,$3,$4,$5,true) r', [other.hash, otpHmac(inv.id, '999999'), p.pdfSha, image.toString('base64'), shaBytes(image)])).resultado, 'OTP_INCORRECTO');
  });

  // ---------------------------------------------------------------- hash del documento
  test('hash: visualización, consentimiento y firma quedan atados al PDF exacto del proceso', async () => {
   const p = await pending();
   const inv = await invite(p, p.signers[0].id);
   const other = sha('otro PDF');
   await assert.rejects(view(inv, other), err => err.code === 'RF002');
   // Sin visualizar no hay consentimiento, y este exige aceptación expresa y la versión vigente.
   await assert.rejects(consent(inv), err => err.code === 'RF003');
   await view(inv);
   await assert.rejects(consent(inv, { hash: other }), err => err.code === 'RF002');
   await assert.rejects(consent(inv, { accept: false }), err => err.code === 'RF003');
   await assert.rejects(consent(inv, { version: 'OTRA' }), err => err.code === 'RF003');
   const consentId = await consent(inv);
   await sendOtp(inv);
   await assert.rejects(signWith(inv, '123456', other), err => err.code === 'RF002');
   assert.equal((await otps(inv))[0].intentos, 0, 'un hash ajeno no consume intentos');
   assert.equal((await signWith(inv)).resultado, 'FIRMADO');
   const firma = (await priv('select * from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]))[0];
   const c = (await priv('select * from firma_privada.consentimientos_firma where id=$1', [consentId]))[0];
   const seen = (await priv('select * from firma_privada.eventos_firma where id=$1', [c.visualizacion_id]))[0];
   assert.deepEqual([firma.sha256_documento, c.sha256_documento, seen.sha256_documento], [p.pdfSha, p.pdfSha, p.pdfSha]);
   assert.ok(c.texto.includes(p.pdfSha));
   // Ni el propietario puede enlazar la evidencia con otro hash (FK compuestas).
   await assert.rejects(owner(() => db.query(`insert into firma_privada.consentimientos_firma(invitacion_id,proceso_firma_id,firmante_id,visualizacion_id,sha256_documento,version,texto,otorgado_at)
    values($1,$2,$3,$4,$5,$6,$7,now())`, [randomUUID(), p.processId, p.signers[1].id, c.visualizacion_id, other, CONSENT, `texto ${other}`])), /foreign key|llave foránea/i);
   await assert.rejects(owner(() => db.query(`insert into firma_privada.firmas_electronicas(proceso_firma_id,firmante_id,invitacion_id,consentimiento_id,otp_id,sha256_documento,persona_firmante_id,nombre_firmante,correo,firmado_at)
    values($1,$2,$3,$4,$5,$6,$7,'X','x@example.com',now())`, [p.processId, p.signers[1].id, randomUUID(), consentId, randomUUID(), other, ids.tenant])), /inconsistente|foreign key/i);
  });

  // ---------------------------------------------------------------- firma dibujada
  test('firma dibujada: se guarda el PNG exacto, privado, con su hash y su huella', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   const image = png('trazo-del-firmante');
   const result = await signWith(inv, '123456', p.pdfSha, { image });
   assert.equal(result.sha256_firma, shaBytes(image));
   const firma = (await priv('select * from firma_privada.firmas_electronicas where id=$1', [result.firma_id]))[0];
   assert.deepEqual(Buffer.from(firma.firma_png), image);
   assert.equal(firma.sha256_firma, shaBytes(image));
   assert.equal(firma.sha256_evidencia, result.sha256_evidencia);
   // Reproducible desde los datos guardados, e independiente de la zona horaria de la sesión.
   const recompute = () => priv(`select firma_privada.huella_firma(id,proceso_firma_id,firmante_id,invitacion_id,consentimiento_id,otp_id,persona_firmante_id,correo,sha256_documento,sha256_firma,firmado_at) h
    from firma_privada.firmas_electronicas where id=$1`, [firma.id]);
   assert.equal((await recompute())[0].h, firma.sha256_evidencia);
   await db.exec("SET TIME ZONE 'Asia/Tokyo'");
   try { assert.equal((await recompute())[0].h, firma.sha256_evidencia); } finally { await db.exec('RESET TIME ZONE'); }
   // Cada dato vinculado cambia la huella.
   const altered = (await priv(`select firma_privada.huella_firma(id,proceso_firma_id,firmante_id,invitacion_id,consentimiento_id,otp_id,persona_firmante_id,correo,$2,sha256_firma,firmado_at) d,
    firma_privada.huella_firma(id,proceso_firma_id,firmante_id,invitacion_id,consentimiento_id,otp_id,persona_firmante_id,correo,sha256_documento,$2,firmado_at) i,
    firma_privada.huella_firma(id,proceso_firma_id,firmante_id,$3::uuid,consentimiento_id,otp_id,persona_firmante_id,correo,sha256_documento,sha256_firma,firmado_at) v
    from firma_privada.firmas_electronicas where id=$1`, [firma.id, sha('otro'), randomUUID()]))[0];
   for (const value of Object.values(altered)) assert.notEqual(value, firma.sha256_evidencia);
   // Solo un administrador recupera la imagen; ningún cliente lee la tabla.
   const shown = await one('select obtener_firma_dibujada($1,$2) r', [ids.admin, firma.id]);
   assert.deepEqual(Buffer.from(shown.imagen_base64, 'base64'), image);
   await assert.rejects(one('select obtener_firma_dibujada($1,$2) r', [ids.user, firma.id]), err => err.code === '42501');
   await assert.rejects(admin(() => db.query('select obtener_firma_dibujada($1,$2)', [ids.admin, firma.id])), /permission denied/);
   assert.ok(!JSON.stringify(await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId])).includes('firma_png'));
  });

  test('firma dibujada: sin confirmar o inválida no firma ni consume intentos; un código incorrecto no guarda la imagen', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   const noImage = code => err => err.code === code;
   await assert.rejects(signWith(inv, '123456', p.pdfSha, { confirm: false }), noImage('RF003'));
   await assert.rejects(signWith(inv, '123456', p.pdfSha, { image: Buffer.from('%PDF-no es una imagen'.padEnd(100, 'x')) }), noImage('RF008'));
   await assert.rejects(signWith(inv, '123456', p.pdfSha, { image: png('corta').subarray(0, 40) }), noImage('RF008'));
   await assert.rejects(signWith(inv, '123456', p.pdfSha, { image: png('grande', 262145) }), noImage('RF008'));
   await assert.rejects(signWith(inv, '123456', p.pdfSha, { image: png(), imageHash: sha('otro') }), noImage('RF008'));
   await assert.rejects(one('select firmar_documento_electronico($1,$2,$3,$4,$5,true) r', [inv.hash, otpHmac(inv.id, '123456'), p.pdfSha, '***no-es-base64***', sha('x')]), noImage('RF008'));
   assert.equal((await otps(inv))[0].intentos, 0, 'ningún rechazo de imagen consume intentos');
   assert.equal((await signWith(inv, '000000')).resultado, 'OTP_INCORRECTO');
   assert.equal((await priv('select count(*)::int n from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]))[0].n, 0);
   assert.equal((await signWith(inv, '123456', p.pdfSha, { image: png('tope', 262144) })).resultado, 'FIRMADO');
  });

  test('firma dibujada: ni el propietario la sustituye ni guarda una evidencia con huella o hash falsos', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   const { firma_id: id } = await signWith(inv);
   await assert.rejects(owner(() => db.query("update firma_privada.firmas_electronicas set firma_png=$2 where id=$1", [id, png()])), /inmutable/);
   const q = await pending();
   const other = await ready(q, q.signers[0].id);
   const row = (await priv('select id from firma_privada.consentimientos_firma where invitacion_id=$1', [other.id]))[0];
   const otp = (await otps(other))[0];
   await bypass('update firma_privada.otps_firma set consumido_at=now() where id=$1', [otp.id]);
   const image = png('falsa');
   const firmaId = randomUUID(); const at = '2026-11-03T12:00:00Z';
   const signer = (await rows('select persona_firmante_id p from firmantes_proceso where id=$1', [q.signers[0].id]))[0].p;
   const insert = (imageHash, evidence) => owner(() => db.query(`insert into firma_privada.firmas_electronicas(id,proceso_firma_id,firmante_id,invitacion_id,consentimiento_id,otp_id,sha256_documento,persona_firmante_id,nombre_firmante,correo,firma_png,sha256_firma,sha256_evidencia,firmado_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,'X',$9,$10,$11,$12,$13)`, [firmaId, q.processId, q.signers[0].id, other.id, row.id, otp.id, q.pdfSha, signer, other.out.correo, image, imageHash, evidence, at]));
   // Huella inventada: la rechaza el trigger.
   await assert.rejects(insert(shaBytes(image), sha('huella inventada')), /inconsistente/);
   // Huella correcta de un hash que no es el de la imagen: la rechaza el CHECK.
   const wrong = sha('otra imagen');
   const huella = (await priv('select firma_privada.huella_firma($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) h', [firmaId, q.processId, q.signers[0].id, other.id, row.id, otp.id, signer, other.out.correo, q.pdfSha, wrong, at]))[0].h;
   await assert.rejects(insert(wrong, huella), /check constraint|restricci/i);
  });

  // ---------------------------------------------------------------- PDF final y finalización automática
  test('finalización: no existe un cierre manual', async () => {
   assert.equal((await rows("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='completar_proceso_firma'"))[0].n, 0);
  });

  for (const order of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
   test(`finalización con varios firmantes, en orden ${order.join('-')}: solo la última firma pide el PDF y solo el PDF cierra`, async () => {
    const p = await pending();
    const invs = [];
    // Las tres invitaciones conviven: quien llega último decide, no el orden de emisión.
    for (const s of p.signers) invs.push(await ready(p, s.id));
    for (const [position, index] of order.entries()) {
     const last = position === order.length - 1;
     if (!last) await assert.rejects(pdfData(p), err => err.code === 'RF006');
     const result = await signWith(invs[index]);
     assert.deepEqual([result.resultado, result.pdf_final_requerido, Number(result.firmantes_pendientes)], ['FIRMADO', last, order.length - position - 1]);
     assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
    }
    assert.ok((await one('select listar_procesos_por_finalizar() r')).includes(p.processId));
    await finalize(p);
    assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['COMPLETADO', 'FIRMADO']);
    assert.ok(!(await one('select listar_procesos_por_finalizar() r')).includes(p.processId));
    const completed = (await priv("select invitacion_id from firma_privada.eventos_firma where proceso_firma_id=$1 and tipo='PROCESO_COMPLETADO'", [p.processId]));
    assert.deepEqual(completed.map(e => e.invitacion_id), [invs[order.at(-1)].id], 'un solo evento de cierre');
    for (const inv of invs) await assert.rejects(signWith(inv), INVALID);
   });
  }

  test('PDF final: incorpora todas las firmas y registra hash, ruta, objeto y manifiesto', async () => {
   const p = await pending({ guarantor: false });
   const images = {};
   for (const s of p.signers) {
    const inv = await ready(p, s.id);
    images[s.id] = png(s.id);
    await signWith(inv, '123456', p.pdfSha, { image: images[s.id] });
   }
   const data = await pdfData(p);
   assert.equal(data.sha256_documento_origen, p.pdfSha);
   assert.equal(data.ruta_pdf_final, `${p.contractId}/firmas/${p.processId}/firmado.pdf`);
   assert.equal(data.manifiesto.length, 2);
   assert.equal(data.sha256_manifiesto, (await priv('select firma_privada.sha256_texto(firma_privada.manifiesto_firmas($1)::text) h', [p.processId]))[0].h);
   for (const entry of data.manifiesto) {
    assert.equal(entry.sha256_firma, shaBytes(images[entry.firmante_id]));
    assert.equal(entry.sha256_documento, p.pdfSha);
    const image = data.imagenes.find(i => i.firma_id === entry.firma_id);
    assert.deepEqual(Buffer.from(image.imagen_base64, 'base64'), images[entry.firmante_id]);
   }
   const final = await finalize(p);
   const row = (await priv('select * from firma_privada.pdfs_finales_firma where id=$1', [final.pdf_final_id]))[0];
   const object = (await rows('select id,metadata from storage.objects where name=$1', [data.ruta_pdf_final]))[0];
   assert.deepEqual([row.sha256, row.sha256_documento_origen, row.storage_path, Number(row.size_bytes), row.mime_type, row.storage_object_id, row.storage_etag, row.sha256_manifiesto, row.generador],
    [final.hash, p.pdfSha, data.ruta_pdf_final, 8192, 'application/pdf', object.id, object.metadata.eTag, data.sha256_manifiesto, 'generador-prueba']);
   assert.deepEqual(row.manifiesto, data.manifiesto);
   assert.equal((await rows('select sha256_documento_firmado s from procesos_firma where id=$1', [p.processId]))[0].s, final.hash);
  });

  test('PDF final: sin un registro correcto el contrato no pasa a FIRMADO, y se puede reintentar', async () => {
   const p = await pending({ guarantor: false });
   for (const s of p.signers) await signOne(p, s.id);
   const data = await pdfData(p);
   const manifest = data.sha256_manifiesto;
   const hash = sha('final-' + p.processId);
   const stillPending = async () => {
    assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
    assert.equal((await priv('select count(*)::int n from firma_privada.pdfs_finales_firma where proceso_firma_id=$1', [p.processId]))[0].n, 0);
   };
   const RF009 = err => err.code === 'RF009';
   // La subida no ocurrió o quedó mal.
   await assert.rejects(registerPdf(p, { manifest, hash }), RF009); await stillPending();
   await putObject(data.ruta_pdf_final, { bytes: 8192, mime: 'image/png' });
   await assert.rejects(registerPdf(p, { manifest, hash }), RF009); await stillPending();
   await db.query('delete from storage.objects where name=$1', [data.ruta_pdf_final]);
   await putObject(data.ruta_pdf_final, { bytes: 9000 });
   await assert.rejects(registerPdf(p, { manifest, hash }), RF009); await stillPending();
   await db.query('delete from storage.objects where name=$1', [data.ruta_pdf_final]);
   await putObject(`${p.contractId}/firmas/${p.processId}/otra-ruta.pdf`);
   await assert.rejects(registerPdf(p, { manifest, hash }), RF009); await stillPending();
   await putObject(data.ruta_pdf_final);
   // Datos que no corresponden al proceso.
   await assert.rejects(registerPdf(p, { manifest: sha('otras firmas'), hash }), RF009); await stillPending();
   await assert.rejects(registerPdf(p, { manifest, hash, origin: sha('otro origen') }), RF009); await stillPending();
   await assert.rejects(registerPdf(p, { manifest, hash: p.pdfSha }), RF009); await stillPending();
   await assert.rejects(registerPdf(p, { manifest, hash: 'corto' }), RF009); await stillPending();
   await assert.rejects(registerPdf(p, { manifest, hash, bytes: 0 }), RF009); await stillPending();
   await assert.rejects(registerPdf(p, { manifest, hash, generator: ' ' }), RF009); await stillPending();
   // Reintento correcto; repetirlo tras perder la respuesta es idempotente; otro hash ya no se acepta.
   const first = await registerPdf(p, { manifest, hash });
   assert.equal(first.ya_registrado, false);
   assert.equal(await contractState(p.contractId), 'FIRMADO');
   const again = await registerPdf(p, { manifest, hash });
   assert.deepEqual([again.ya_registrado, again.pdf_final_id], [true, first.pdf_final_id]);
   assert.equal((await priv('select count(*)::int n from firma_privada.pdfs_finales_firma where proceso_firma_id=$1', [p.processId]))[0].n, 1);
   await assert.rejects(registerPdf(p, { manifest, hash: sha('otro final') }), /no pendiente/);
   await assert.rejects(pdfData(p), /no pendiente/);
  });

  test('PDF final: faltando una firma no se registra, y su hash no se repite entre procesos', async () => {
   const p = await pending({ guarantor: false });
   await signOne(p, p.signers[0].id);
   const ruta = `${p.contractId}/firmas/${p.processId}/firmado.pdf`;
   await putObject(ruta);
   await assert.rejects(registerPdf(p, { manifest: sha('x'), hash: sha('x') }), err => err.code === 'RF006');
   await signOne(p, p.signers[1].id);
   const manifest = (await pdfData(p)).sha256_manifiesto;
   const hash = sha('final-repetido-' + p.processId);
   await registerPdf(p, { manifest, hash });
   const q = await pending({ guarantor: false });
   for (const s of q.signers) await signOne(q, s.id);
   const data = await pdfData(q);
   await putObject(data.ruta_pdf_final);
   await assert.rejects(registerPdf(q, { manifest: data.sha256_manifiesto, hash }), /llave duplicada|duplicate key|unique/i);
   assert.equal(await contractState(q.contractId), 'PENDIENTE_FIRMA');
  });

  test('PDF final: es inmutable y ni el propietario llega a COMPLETADO o FIRMADO sin él', async () => {
   const p = await pending({ guarantor: false });
   for (const s of p.signers) await signOne(p, s.id);
   const data = await pdfData(p);
   // Todas las firmas, sin PDF: ni el proceso, ni el contrato, ni un PDF inventado.
   await assert.rejects(owner(() => db.query("update procesos_firma set estado='COMPLETADO',completado_at=now() where id=$1", [p.processId])), /falta el PDF final/);
   await assert.rejects(owner(() => db.query("update procesos_firma set estado='COMPLETADO',completado_at=now(),pdf_final_id=$2,sha256_documento_firmado=$3,pdf_final_at=now() where id=$1", [p.processId, randomUUID(), sha('x')])), /falta el PDF final/);
   await assert.rejects(owner(() => db.query("update contratos set estado='FIRMADO' where id=$1", [p.contractId])), /controlados/);
   const insert = manifest => owner(() => db.query(`insert into firma_privada.pdfs_finales_firma(proceso_firma_id,contrato_id,sha256_documento_origen,sha256,size_bytes,mime_type,storage_path,storage_object_id,manifiesto,sha256_manifiesto,generador,registrado_at)
    values($1,$2,$3,$4,8192,'application/pdf',$5,$6,$7::jsonb,$8,'g',now())`, [p.processId, p.contractId, p.pdfSha, sha('falso'), data.ruta_pdf_final, randomUUID(), JSON.stringify(manifest), sha(JSON.stringify(manifest))]));
   await assert.rejects(insert(data.manifiesto), /PDF final inconsistente/);
   await assert.rejects(service(() => db.query('select * from firma_privada.pdfs_finales_firma')), /permission denied/);
   for (const role of [admin, fn => as('anon', fn)]) {
    await assert.rejects(role(() => db.query('select datos_pdf_final_firma($1)', [p.processId])), /permission denied/);
    await assert.rejects(role(() => db.query("select registrar_pdf_final_firma($1,'a','b','c',1,'g')", [p.processId])), /permission denied/);
    await assert.rejects(role(() => db.query('select listar_procesos_por_finalizar()')), /permission denied/);
   }
   const final = await finalize(p);
   await assert.rejects(owner(() => db.query("update firma_privada.pdfs_finales_firma set sha256=$2 where id=$1", [final.pdf_final_id, sha('otro')])), /inmutable/);
   await assert.rejects(owner(() => db.query('delete from firma_privada.pdfs_finales_firma where id=$1', [final.pdf_final_id])), /inmutable/);
   await assert.rejects(owner(() => db.query('truncate firma_privada.pdfs_finales_firma cascade')), /inmutable/);
   await assert.rejects(owner(() => db.query('update procesos_firma set sha256_documento_firmado=$2 where id=$1', [p.processId, sha('otro')])), /Proceso cerrado/);
  });

  test('PDF final: si se anula con todas las firmas ya no se registra, y el documento no recircula', async () => {
   const p = await pending({ guarantor: false });
   for (const s of p.signers) await signOne(p, s.id);
   const data = await pdfData(p);
   await annul(p, { reason: 'No fue posible generar el PDF final', dest: 'CANCELADO' });
   await putObject(data.ruta_pdf_final);
   await assert.rejects(registerPdf(p, { manifest: data.sha256_manifiesto, hash: sha('tarde') }), /no pendiente/);
   await assert.rejects(pdfData(p), /no pendiente/);
   assert.equal(await contractState(p.contractId), 'CANCELADO');
   assert.ok(!(await one('select listar_procesos_por_finalizar() r')).includes(p.processId));
  });

  test('finalización: un código incorrecto en la última firma no firma ni habilita el PDF', async () => {
   const p = await pending({ guarantor: false });
   await signOne(p, p.signers[0].id);
   const last = await ready(p, p.signers[1].id);
   assert.equal((await signWith(last, '000000')).resultado, 'OTP_INCORRECTO');
   await assert.rejects(pdfData(p), err => err.code === 'RF006');
   assert.equal((await signWith(last)).pdf_final_requerido, true);
   assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
  });

  test('finalización atómica: si falla el cambio del contrato se revierte el PDF registrado, conservando las firmas, y se puede reintentar', async () => {
   const p = await pending({ guarantor: false });
   for (const s of p.signers) await signOne(p, s.id);
   const data = await pdfData(p);
   await putObject(data.ruta_pdf_final);
   const hash = sha('final-' + p.processId);
   await db.exec(`CREATE FUNCTION public.falla_sim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.estado::text='FIRMADO' THEN RAISE EXCEPTION 'fallo inyectado'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER falla_sim BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.falla_sim();`);
   try { await assert.rejects(registerPdf(p, { manifest: data.sha256_manifiesto, hash }), /fallo inyectado/); }
   finally { await db.exec('DROP TRIGGER falla_sim ON public.contratos; DROP FUNCTION public.falla_sim();'); }
   assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
   assert.deepEqual(await signerStates(p.processId), ['FIRMADO', 'FIRMADO']);
   assert.equal((await priv('select count(*)::int n from firma_privada.pdfs_finales_firma where proceso_firma_id=$1', [p.processId]))[0].n, 0);
   assert.equal((await priv("select count(*)::int n from firma_privada.eventos_firma where proceso_firma_id=$1 and tipo='PROCESO_COMPLETADO'", [p.processId]))[0].n, 0);
   await registerPdf(p, { manifest: data.sha256_manifiesto, hash });
   assert.equal(await contractState(p.contractId), 'FIRMADO');
  });

  test('finalización: si la cobertura aprobada cambió, la última firma se rechaza sin efectos y el proceso sigue anulable', async () => {
   const p = await pending({ guarantor: false });
   await signOne(p, p.signers[0].id);
   const last = await ready(p, p.signers[1].id);
   const setApproval = text => bypass("update firma_privada.cobertura_plantilla set aprobacion=$2 where version_plantilla_id=$1 and rol='FIADOR'", [ids.v2, text]);
   await setApproval('Otra aprobación');
   try {
    await assert.rejects(signWith(last), err => err.code === 'RF006');
    assert.deepEqual((await signerStates(p.processId)).sort(), ['FIRMADO', 'PENDIENTE']);
    assert.equal((await otps(last))[0].consumido_at, null);
    assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
   } finally { await setApproval('Aprobación jurídica de prueba'); }
   // Si cambia después de la última firma, el registro del PDF también se rechaza y se puede reintentar.
   await signWith(last);
   const data = await pdfData(p);
   await putObject(data.ruta_pdf_final);
   await setApproval('Otra aprobación');
   try {
    await assert.rejects(registerPdf(p, { manifest: data.sha256_manifiesto, hash: sha('f' + p.processId) }), err => err.code === 'RF006');
    assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
   } finally { await setApproval('Aprobación jurídica de prueba'); }
   await annul(p);
   assert.equal(await contractState(p.contractId), 'BORRADOR');
  });

  test('finalización: ni el propietario fuera de RPC salta las firmas, y un firmante no pasa a FIRMADO sin evidencia', async () => {
   const p = await pending();
   await assert.rejects(owner(() => db.query("update firmantes_proceso set estado='FIRMADO',firmado_at=now(),registrado_por=$2 where id=$1", [p.signers[0].id, ids.admin])), /sin evidencia/);
   await assert.rejects(owner(() => db.query("update procesos_firma set estado='COMPLETADO',completado_at=now() where id=$1", [p.processId])), /faltan firmas obligatorias/);
   await assert.rejects(owner(() => db.query("update contratos set estado='FIRMADO' where id=$1", [p.contractId])), /controlados/);
   // Firmante marcado FIRMADO saltando el trigger (acceso fuera de banda): la última firma lo detecta y se revierte.
   await bypass("update firmantes_proceso set estado='FIRMADO',firmado_at=now(),registrado_por=$2 where id=$1", [p.signers[2].id, ids.admin]);
   await signOne(p, p.signers[0].id);
   const last = await ready(p, p.signers[1].id);
   await assert.rejects(signWith(last), err => err.code === 'RF006');
   assert.equal((await processRow(p.processId)).estado, 'PENDIENTE');
   await assert.rejects(owner(() => db.query("update procesos_firma set estado='COMPLETADO',completado_at=now() where id=$1", [p.processId])), /faltan firmas obligatorias/);
  });

  test('atomicidad: si falla el último paso de la firma no queda nada', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   const eventsBefore = await events(inv);
   await db.exec(`CREATE FUNCTION public.falla_sim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo inyectado'; END $$;
    CREATE TRIGGER falla_sim BEFORE UPDATE ON public.firmantes_proceso FOR EACH ROW EXECUTE FUNCTION public.falla_sim();`);
   try { await assert.rejects(signWith(inv), /fallo inyectado/); }
   finally { await db.exec('DROP TRIGGER falla_sim ON public.firmantes_proceso; DROP FUNCTION public.falla_sim();'); }
   assert.equal((await otps(inv))[0].consumido_at, null);
   assert.equal((await invitation(inv)).usada_at, null);
   assert.equal((await priv('select count(*)::int n from firma_privada.firmas_electronicas where invitacion_id=$1', [inv.id]))[0].n, 0);
   assert.deepEqual(await events(inv), eventsBefore);
   assert.equal((await signWith(inv)).resultado, 'FIRMADO');
  });

  // ---------------------------------------------------------------- cancelar, anular y procesos previos
  test('proceso previo (MANUAL): no admite firma electrónica; se cancela y se reinicia con el mismo documento', async () => {
   assert.deepEqual([(await processRow(legacy.processId)).metodo, (await processRow(legacy.processId)).estado], ['MANUAL', 'PENDIENTE']);
   await assert.rejects(invite(legacy, legacy.signers[0].id), /cancélalo e inicia uno nuevo/);
   await assert.rejects(owner(() => db.query("update procesos_firma set metodo='ELECTRONICA_SIMPLE' where id=$1", [legacy.processId])), /Identidad del proceso inmutable/);
   await cancel(legacy);
   assert.equal(await contractState(legacy.contractId), 'BORRADOR');
   const again = await start(legacy.contractId, { documentId: legacy.documentId, pdfSha: legacy.pdfSha });
   assert.equal((await processRow(again.processId)).metodo, 'ELECTRONICA_SIMPLE');
   await signAll(again); await finalize(again);
   assert.equal(await contractState(legacy.contractId), 'FIRMADO');
  });

  test('cancelar: sin firmas sigue disponible e invalida invitaciones y OTP; con firmas se rechaza', async () => {
   const p = await pending();
   const inv = await ready(p, p.signers[0].id);
   await cancel(p);
   assert.equal(await contractState(p.contractId), 'BORRADOR');
   for (const step of [() => open(inv), () => signWith(inv), () => invite(p, p.signers[1].id)]) await assert.rejects(step(), err => err.code === 'RF001' || /no pendiente/.test(err.message));
   // El consentimiento se conserva como evidencia del intento.
   assert.equal((await priv('select count(*)::int n from firma_privada.consentimientos_firma where invitacion_id=$1', [inv.id]))[0].n, 1);
   const q = await pending();
   await signOne(q, q.signers[0].id);
   await assert.rejects(cancel(q), /firmas\/evidencias/);
   await assert.rejects(owner(() => db.query("update procesos_firma set estado='CANCELADO',cancelado_at=now(),cancelado_por=$2,motivo_cancelacion='x' where id=$1", [q.processId, ids.admin])), /no se cancela/);
  });

  test('anular: firmas parciales, destino expreso, evidencia intacta y documento que no vuelve a circular', async () => {
   const p = await pending();
   await assert.rejects(annul(p), /usa cancelar_proceso_firma/);
   const { inv: signed } = await signOne(p, p.signers[0].id);
   const open2 = await ready(p, p.signers[1].id);
   const before = { signers: await rows('select * from firmantes_proceso where proceso_firma_id=$1 order by id', [p.processId]), evidence: await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId]), doc: (await rows('select * from documentos_contrato where id=$1', [p.documentId]))[0] };
   await assert.rejects(annul(p, { reason: 'corto' }), /10 a 1000/);
   await assert.rejects(annul(p, { dest: 'FIRMADO' }), /Destino/);
   await assert.rejects(annul(p, { sub: ids.user }), err => err.code === '42501');
   await annul(p);
   const process = await processRow(p.processId);
   assert.deepEqual([process.estado, process.anulado_por, process.destino_contrato_anulacion], ['ANULADO', ids.admin, 'BORRADOR']);
   assert.equal(await contractState(p.contractId), 'BORRADOR');
   assert.deepEqual(await rows('select * from firmantes_proceso where proceso_firma_id=$1 order by id', [p.processId]), before.signers);
   assert.deepEqual(await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId]), before.evidence);
   assert.deepEqual((await rows('select * from documentos_contrato where id=$1', [p.documentId]))[0], before.doc);
   // Invitaciones vivas sin efecto; nada se puede repetir ni cerrar otra vez.
   for (const step of [() => signWith(open2), () => open(signed)]) await assert.rejects(step(), INVALID);
   await assert.rejects(annul(p), /no pendiente/);
   await assert.rejects(owner(() => db.query("update procesos_firma set motivo_anulacion='cambiado en proceso' where id=$1", [p.processId])), /Proceso cerrado/);
   // El mismo documento y el mismo hash no se reutilizan; una revisión nueva sí.
   await assert.rejects(start(p.contractId, { documentId: p.documentId, pdfSha: p.pdfSha }), /proceso cancelado previo/);
   await assert.rejects(start(p.contractId, { pdfSha: p.pdfSha }), /pertenece a un proceso anulado/);
   const next = await start(p.contractId);
   assert.notEqual(next.pdfSha, p.pdfSha);
   await signAll(next); await finalize(next);
   assert.equal(await contractState(p.contractId), 'FIRMADO');
   // Destino CANCELADO, y solo por esta vía.
   const q = await pending();
   await signOne(q, q.signers[0].id);
   await assert.rejects(owner(() => db.query("update contratos set estado='CANCELADO' where id=$1", [q.contractId])), /controlados/);
   await annul(q, { dest: 'CANCELADO' });
   assert.equal(await contractState(q.contractId), 'CANCELADO');
  });

  // ---------------------------------------------------------------- protección de tablas
  test('escrituras directas: rechazadas para clientes y, sobre la evidencia, también para el propietario', async () => {
   const p = await pending();
   const { inv } = await signOne(p, p.signers[0].id);
   for (const run of [admin, service]) {
    for (const table of PRIVATE_TABLES) await assert.rejects(run(() => db.query(`select * from ${table}`)), /permission denied/, table);
    await assert.rejects(run(() => db.query("update firmantes_proceso set estado='FIRMADO' where proceso_firma_id=$1", [p.processId])), /permission denied/);
    await assert.rejects(run(() => db.query("update procesos_firma set estado='COMPLETADO' where id=$1", [p.processId])), /permission denied/);
   }
   for (const fn of ['abrir_invitacion_firma($1)', "firmar_documento_electronico($1,'a','b','c','d',true)"]) {
    await assert.rejects(admin(() => db.query(`select ${fn}`, [inv.hash])), /permission denied/);
    await assert.rejects(as('anon', () => db.query(`select ${fn}`, [inv.hash])), /permission denied/);
   }
   await assert.rejects(owner(() => db.query('truncate firma_privada.cambios_correo_firmante')), /inmutable/);
   for (const table of ['eventos_firma', 'consentimientos_firma', 'firmas_electronicas']) {
    await assert.rejects(owner(() => db.query(`update firma_privada.${table} set user_agent=user_agent`)), /inmutable/, table);
    await assert.rejects(owner(() => db.query(`delete from firma_privada.${table}`)), /inmutable/, table);
    await assert.rejects(owner(() => db.query(`truncate firma_privada.${table} cascade`)), /inmutable|No se elimina/, table);
   }
   await assert.rejects(owner(() => db.query('delete from firma_privada.invitaciones_firma where id=$1', [inv.id])), /No se elimina/);
   await assert.rejects(owner(() => db.query("update firma_privada.invitaciones_firma set correo='otro@example.com' where id=$1", [inv.id])), /solo se marca una vez/);
   await assert.rejects(owner(() => db.query("update firma_privada.otps_firma set intentos=0 where invitacion_id=$1", [inv.id])), /cerrado/);
   // Un OTP vivo no puede reescribirse, ni reducir sus intentos.
   const q = await pending();
   const live = await ready(q, q.signers[0].id);
   await signWith(live, '000000');
   await assert.rejects(owner(() => db.query('update firma_privada.otps_firma set intentos=0 where invitacion_id=$1', [live.id])), /no permitido/);
   await assert.rejects(owner(() => db.query("update firma_privada.otps_firma set otp_hmac=$2 where invitacion_id=$1", [live.id, sha('x')])), /no permitido/);
   await assert.rejects(owner(() => db.query("update firma_privada.invitaciones_firma set usada_at=now() where id=$1", [live.id])), /usada sin firma/);
   // La tabla evidencias_firma de la etapa 1 sigue cerrada.
   await assert.rejects(owner(() => db.query("insert into evidencias_firma(proceso_firma_id,storage_path,sha256,mime_type,size_bytes,uploaded_by) values($1,'x',$2,'application/pdf',1,$3)", [q.processId, sha('d'), ids.admin])), /no habilitado/);
  });

  test('consultar evidencia: solo administradores y sin hash de token ni HMAC', async () => {
   const p = await pending();
   const { inv } = await signOne(p, p.signers[0].id);
   await assert.rejects(one('select consultar_evidencia_firma($1,$2) r', [ids.user, p.processId]), err => err.code === '42501');
   const dump = JSON.stringify(await one('select consultar_evidencia_firma($1,$2) r', [ids.admin, p.processId]));
   assert.ok(!dump.includes(inv.hash));
   assert.ok(!dump.includes(otpHmac(inv.id, '123456')));
   assert.ok(!dump.includes('otp_hmac'));
   assert.ok(!dump.includes('token_hash'));
  });
 });
}

suite('estado/tipo text', { enums: false });
suite('estado/tipo enum', { enums: true });
