import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
// SQL real en PostgreSQL local en memoria (PGlite). Jamás contra Supabase.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const INSTALLER = read('../docs/sql/firmas-2c/02_infraestructura_corregida.sql');
const ORIGINAL = read('../docs/sql/firmas-2c/01_infraestructura.sql');
const ids = {
 admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', admin2: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 rep: '11111111-1111-4111-8111-111111111111', company: '22222222-2222-4222-8222-222222222222', tenant: '33333333-3333-4333-8333-333333333333',
 guarantor: '44444444-4444-4444-8444-444444444444', joint: '55555555-5555-4555-8555-555555555555', landlordPerson: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 legacy: 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', template: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 v2: 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2', v3: 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', v4: 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4',
 v5: 'c5c5c5c5-c5c5-4c5c-8c5c-c5c5c5c5c5c5', v6: 'c6c6c6c6-c6c6-4c6c-8c6c-c6c6c6c6c6c6',
};
const HTML = { v2: '<p>{{arrendador.bloques.firma}} {{arrendatario.nombre_completo}} {{fiador.nombre_completo}}</p>', v3: '<p>V3 {{obligado_solidario.nombre_completo}}</p>', v4: '<p>V4 sin cobertura</p>', v5: '<p>V5 editable</p>', v6: '<p>V6 editable</p>' };
const COVERAGE = {
 v2: [{ rol: 'ARRENDADOR', minimo: 1, maximo: 1, entidades: ['PERSONA_MORAL', 'PERSONA'] }, { rol: 'ARRENDATARIO', minimo: 1, maximo: 1, entidades: ['PERSONA'] }, { rol: 'FIADOR', minimo: 0, maximo: 1, entidades: ['PERSONA'] }],
};
COVERAGE.v3 = [...COVERAGE.v2, { rol: 'OBLIGADO_SOLIDARIO', minimo: 0, maximo: 1, entidades: ['PERSONA'] }];
// v5/v6 nunca se usan para iniciar antes de editarlas: permiten probar cambios de plantilla.
COVERAGE.v5 = COVERAGE.v2; COVERAGE.v6 = COVERAGE.v2;
// Supuesto explícito: valores de enums conocidos por los tipos TypeScript; los reales no están confirmados.
const ENUMS = `
CREATE TYPE public.estado_contrato AS ENUM('BORRADOR','PENDIENTE_FIRMA','FIRMADO','ACTIVO','FINALIZADO','CANCELADO','TERMINADO_ANTICIPADAMENTE');
CREATE TYPE public.tipo_documento AS ENUM('BORRADOR','PARA_FIRMA','FIRMADO');
CREATE TYPE public.estado_documento AS ENUM('GENERADO','ENVIADO','REEMPLAZADO','ANULADO');
ALTER TABLE public.contratos ALTER COLUMN estado DROP DEFAULT, ALTER COLUMN estado TYPE public.estado_contrato USING estado::public.estado_contrato, ALTER COLUMN estado SET DEFAULT 'BORRADOR';
ALTER TABLE public.documentos_contrato ALTER COLUMN tipo TYPE public.tipo_documento USING tipo::public.tipo_documento, ALTER COLUMN estado TYPE public.estado_documento USING estado::public.estado_documento;`;

async function baseDb({ enums = false } = {}) {
 const db = new PGlite();
 await db.exec(read('./fixtures/partes-schema.sql').replaceAll('fixture_contract_folio_seq', 'contratos_folio_seq'));
 await db.exec(read('../docs/sql/partes-2b0/01_esquema.sql'));
 // Solo la copia en memoria adapta la huella al fixture sintético, igual que partes-sql.test.mjs.
 const hash = (await db.query("select md5(pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure)) h")).rows[0].h;
 await db.exec(read('../docs/sql/partes-2b0/02_rpc.sql').replace('c1e2e7ed4a9dd613bbbbe06f4dae50b7', hash));
 await db.exec(read('./fixtures/firmas-2c-schema.sql'));
 if (enums) await db.exec(ENUMS);
 return db;
}
function helpers(db) {
 const rows = async (text, params = []) => (await db.query(text, params)).rows;
 async function as(role, fn, sub) {
  if (sub !== undefined) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role').catch(() => {}); }
 }
 const admin = (fn, sub = ids.admin) => as('authenticated', fn, sub);
 const service = fn => as('service_role', fn);
 const owner = fn => as('propietario_sim', fn);
 async function inTransaction(fn) {
  await db.exec('BEGIN');
  try { return await fn(); } finally { await db.exec('ROLLBACK'); await db.exec('reset role'); }
 }
 const abort = async () => { await db.exec('ROLLBACK'); await db.exec('reset role'); };
 return { rows, as, admin, service, owner, inTransaction, abort };
}
// Réplica mínima de templateText/fullName para que el "servidor" de prueba reconstruya el contexto.
const text = value => { const t = value == null ? '' : String(value).trim().replace(/\s+/g, ' '); return /^(null|undefined)$/i.test(t) ? '' : t; };
const fullName = p => (p ? [p.nombre, p.apellido_paterno, p.apellido_materno].map(text).filter(Boolean).join(' ') : '');
const personContext = p => ({ nombre_completo: fullName(p), rfc: text(p?.rfc), curp: text(p?.curp), domicilio: '', telefono: '', correo: '' });

function suite(label, { enums }) {
 describe(`2C corregida (${label})`, () => {
  let db, h, landlordTriggerBefore;
  const rows = (...a) => h.rows(...a);
  before(async () => {
   db = await baseDb({ enums }); h = helpers(db);
   landlordTriggerBefore = (await rows("select pg_get_functiondef('public.partes_2b0_comprobar_arrendador()'::regprocedure) d"))[0].d;
   await h.owner(() => db.exec(INSTALLER));
   for (const [index, v] of ['v2', 'v3', 'v4', 'v5', 'v6'].entries()) await db.query("insert into versiones_plantilla values($1,$2,$3,'BORRADOR',$4)", [ids[v], ids.template, index + 2, HTML[v]]);
   for (const v of ['v2', 'v3', 'v5', 'v6']) await h.owner(() => db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,$3::jsonb,'Aprobación jurídica de prueba')", [ids[v], sha(HTML[v]), JSON.stringify(COVERAGE[v])]));
  });
  after(async () => db.close());

  async function contract({ guarantor = true, joint = false, extraTenant = false, landlord = 'PERSONA_MORAL' } = {}) {
   const app = randomUUID();
   await db.query("insert into solicitudes values($1,1,'aprobada')", [app]);
   const participants = [[ids.tenant, 'solicitante']];
   if (guarantor) participants.push([ids.guarantor, 'fiador']);
   if (joint) participants.push([ids.joint, 'obligado solidario']);
   if (extraTenant) participants.push([ids.rep, 'solicitante']);
   for (const [person, role] of participants) await db.query('insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,$3)', [app, person, role]);
   const entity = landlord === 'PERSONA' ? ids.landlordPerson : ids.company;
   return (await h.admin(() => rows("select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,12000::numeric,12000::numeric,1::integer,$2::text,$3::uuid) id", [app, landlord, entity])))[0].id;
  }
  const person = async id => (await rows('select * from personas where id=$1', [id]))[0];
  const parts = contractId => rows('select id,rol::text rol,persona_id,persona_moral_id from partes_contrato where contrato_id=$1 order by id', [contractId]);
  const principal = async company => rows('select * from representantes_persona_moral where persona_moral_id=$1 and es_principal order by id', [company]);
  // Simula al servidor: reconstruye el contexto desde las fuentes actuales.
  async function snapshotFor(contractId) {
   const list = await parts(contractId);
   const landlord = list.find(p => p.rol === 'ARRENDADOR');
   let arrendador;
   if (landlord.persona_moral_id) {
    const company = (await rows('select * from personas_morales where id=$1', [landlord.persona_moral_id]))[0];
    const [rep] = await principal(company.id);
    const repPerson = rep ? await person(rep.persona_id) : null;
    arrendador = { tipo: 'PERSONA_MORAL', nombre: text(company.razon_social), razon_social: text(company.razon_social), rfc: text(company.rfc),
     representante: { ...personContext(repPerson), caracter: 'Representante legal' }, bloques: { firma: 'resuelto' } };
   } else {
    const p = await person(landlord.persona_id);
    arrendador = { tipo: 'PERSONA', nombre: fullName(p), razon_social: '', rfc: text(p.rfc), representante: null };
   }
   const one = async role => { const part = list.find(p => p.rol === role); return personContext(part ? await person(part.persona_id) : null); };
   const snapshot = { contrato: { folio: 'CTR' }, arrendador, arrendatario: await one('ARRENDATARIO'), fiador: await one('FIADOR'), inmueble: {}, unidad: {} };
   if (list.some(p => p.rol === 'OBLIGADO_SOLIDARIO')) snapshot.obligado_solidario = await one('OBLIGADO_SOLIDARIO');
   return snapshot;
  }
  async function identitiesFor(contractId) {
   const result = [];
   for (const part of await parts(contractId)) {
    const base = { parte_contrato_id: part.id, rol: part.rol, referencia_documento: part.rol.toLowerCase() };
    if (part.persona_moral_id) {
     const [rep] = await principal(part.persona_moral_id);
     result.push({ ...base, entidad_tipo: 'PERSONA_MORAL', entidad_id: part.persona_moral_id, persona_firmante_id: rep?.persona_id ?? null, representante_origen_id: rep?.id ?? null });
    } else result.push({ ...base, entidad_tipo: 'PERSONA', entidad_id: part.persona_id, persona_firmante_id: part.persona_id, representante_origen_id: null });
   }
   return result;
  }
  async function document(contractId, { version = 'v2', snapshot, attach = true } = {}) {
   const context = snapshot ?? await snapshotFor(contractId);
   const html = `<p>${context.arrendatario.nombre_completo}</p>`;
   const id = (await h.admin(() => rows(`insert into documentos_contrato(contrato_id,version_plantilla_id,numero_version,tipo,estado,nombre_archivo,storage_path,datos_snapshot,contenido_renderizado,generated_at)
    values($1,$2,coalesce((select max(numero_version) from documentos_contrato where contrato_id=$1),0)+1,'BORRADOR','GENERADO','CTR-prueba-v1.pdf',null,$3::jsonb,$4,'now') returning id`,
    [contractId, ids[version], JSON.stringify(context), html])))[0].id;
   if (attach) await h.service(() => db.query("update documentos_contrato set storage_path=contrato_id::text||'/'||id::text||'/'||nombre_archivo where id=$1 and storage_path is null", [id]));
   return id;
  }
  // Simula el endpoint futuro: hash del PDF, fuentes, contexto/HTML reconstruidos e identidades.
  async function verify(contractId, documentId, overrides = {}) {
   const doc = (await rows('select * from documentos_contrato where id=$1', [documentId]))[0];
   const template = (await rows('select contenido from versiones_plantilla where id=$1', [doc.version_plantilla_id]))[0];
   const fuentes = (await h.service(() => rows('select firma_fuentes_para_verificar($1) f', [contractId])))[0].f;
   const args = { actor: ids.admin, pdfSha: sha('%PDF-' + documentId), bytes: 2048, fuentes, context: doc.datos_snapshot,
    htmlSha: sha(doc.contenido_renderizado), templateSha: sha(template.contenido), renderer: 'arrendador-v1-moral-1', identities: await identitiesFor(contractId), ...overrides };
   const receipt = (await h.service(() => rows('select registrar_validacion_documento_firma($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb) id',
    [args.actor, contractId, documentId, args.pdfSha, args.bytes, JSON.stringify(args.fuentes), JSON.stringify(args.context), args.htmlSha, args.templateSha, args.renderer, JSON.stringify(args.identities)])))[0].id;
   return { receipt, pdfSha: args.pdfSha };
  }
  const start = (contractId, documentId, pdfSha, receipt, sub = ids.admin) =>
   h.admin(() => rows('select iniciar_proceso_firma($1,$2,$3,$4) id', [contractId, documentId, pdfSha, receipt]), sub).then(r => r[0].id);
  const cancel = (processId, reason = 'Corrección de datos', sub = ids.admin) => h.admin(() => db.query('select cancelar_proceso_firma($1,$2)', [processId, reason]), sub);
  async function pending(options) {
   const contractId = await contract(options);
   const documentId = await document(contractId);
   const { receipt, pdfSha } = await verify(contractId, documentId);
   const processId = await start(contractId, documentId, pdfSha, receipt);
   return { contractId, documentId, receipt, pdfSha, processId };
  }
  const contractState = async id => (await rows('select estado::text e from contratos where id=$1', [id]))[0].e;

  test('instala como propietario no superusuario con BYPASSRLS y deja la RPC 2B.0 intacta', async () => {
   const role = (await rows("select rolsuper,rolbypassrls from pg_roles where rolname='propietario_sim'"))[0];
   assert.deepEqual(role, { rolsuper: false, rolbypassrls: true });
   assert.equal((await rows("select pg_get_userbyid(proowner) o from pg_proc where oid='public.iniciar_proceso_firma(uuid,uuid,text,uuid)'::regprocedure"))[0].o, 'propietario_sim');
   assert.equal((await rows("select pg_get_functiondef('public.partes_2b0_comprobar_arrendador()'::regprocedure) d"))[0].d, landlordTriggerBefore);
   assert.equal((await rows("select count(*)::int n from pg_trigger where tgname in('partes_2b0_integridad','contratos_2b0_integridad') and tgenabled='O' and tgdeferrable"))[0].n, 2);
   await assert.rejects(h.owner(() => db.exec(INSTALLER)), /infraestructura 2C previa/); await h.abort();
  });

  test('flujo completo: congela documento, versión, hashes, cobertura y un firmante inequívoco por parte', async () => {
   const { contractId, documentId, receipt, pdfSha, processId } = await pending();
   assert.equal(await contractState(contractId), 'PENDIENTE_FIRMA');
   const doc = (await rows('select tipo::text tipo,estado::text estado,contenido_renderizado from documentos_contrato where id=$1', [documentId]))[0];
   assert.deepEqual([doc.tipo, doc.estado], ['PARA_FIRMA', 'GENERADO']);
   const process = (await rows('select * from procesos_firma where id=$1', [processId]))[0];
   assert.equal(process.version_plantilla_id, ids.v2); assert.equal(process.sha256_plantilla, sha(HTML.v2));
   assert.equal(process.sha256_html, sha(doc.contenido_renderizado)); assert.equal(process.sha256_documento_origen, pdfSha);
   assert.equal(process.validacion_id, receipt); assert.equal(Number(process.size_bytes_origen), 2048);
   assert.deepEqual(process.cobertura_snapshot.map(x => x.rol), ['ARRENDADOR', 'ARRENDATARIO', 'FIADOR']);
   const signers = await rows('select rol,referencia_documento,entidad_tipo,entidad_id,persona_firmante_id,representante_origen_id,nombre_entidad,caracter from firmantes_proceso where proceso_firma_id=$1 order by rol', [processId]);
   const [rep] = await principal(ids.company);
   assert.deepEqual(signers, [
    { rol: 'ARRENDADOR', referencia_documento: 'arrendador', entidad_tipo: 'PERSONA_MORAL', entidad_id: ids.company, persona_firmante_id: ids.rep, representante_origen_id: rep.id, nombre_entidad: 'Empresa Arrendadora SA de CV', caracter: 'REPRESENTANTE_LEGAL' },
    { rol: 'ARRENDATARIO', referencia_documento: 'arrendatario', entidad_tipo: 'PERSONA', entidad_id: ids.tenant, persona_firmante_id: ids.tenant, representante_origen_id: null, nombre_entidad: 'Solicitante Gómez', caracter: 'POR_DERECHO_PROPIO' },
    { rol: 'FIADOR', referencia_documento: 'fiador', entidad_tipo: 'PERSONA', entidad_id: ids.guarantor, persona_firmante_id: ids.guarantor, representante_origen_id: null, nombre_entidad: 'Fiador López Díaz', caracter: 'POR_DERECHO_PROPIO' }]);
   assert.equal((await h.owner(() => rows('select usado_por from firma_privada.validaciones where id=$1', [receipt])))[0].usado_por, processId);
  });

  test('arrendador persona física (2B.0) firma por derecho propio', async () => {
   const { processId } = await pending({ landlord: 'PERSONA' });
   const landlord = (await rows("select entidad_tipo,persona_firmante_id,caracter,nombre_entidad from firmantes_proceso where proceso_firma_id=$1 and rol='ARRENDADOR'", [processId]))[0];
   assert.deepEqual(landlord, { entidad_tipo: 'PERSONA', persona_firmante_id: ids.landlordPerson, caracter: 'POR_DERECHO_PROPIO', nombre_entidad: 'Lucía Arrendadora' });
  });

  test('OBLIGADO_SOLIDARIO de 2B.0: rechazo explícito sin cobertura; firma cuando la versión lo cubre', async () => {
   const contractId = await contract({ joint: true });
   const v2Doc = await document(contractId, { version: 'v2' });
   await assert.rejects(verify(contractId, v2Doc), /OBLIGADO_SOLIDARIO no está cubierto/);
   const v4Doc = await document(contractId, { version: 'v4' });
   await assert.rejects(verify(contractId, v4Doc), /no tiene cobertura de firma aprobada/);
   const snapshot = await snapshotFor(contractId); delete snapshot.obligado_solidario;
   await assert.rejects(verify(contractId, await document(contractId, { version: 'v3', snapshot })), /no identifica al OBLIGADO_SOLIDARIO/);
   const v3Doc = await document(contractId, { version: 'v3' });
   const { receipt, pdfSha } = await verify(contractId, v3Doc);
   const processId = await start(contractId, v3Doc, pdfSha, receipt);
   const joint = (await rows("select referencia_documento,persona_firmante_id from firmantes_proceso where proceso_firma_id=$1 and rol='OBLIGADO_SOLIDARIO'", [processId]))[0];
   assert.deepEqual(joint, { referencia_documento: 'obligado_solidario', persona_firmante_id: ids.joint });
   assert.equal((await rows('select count(*)::int n from firmantes_proceso where proceso_firma_id=$1', [processId]))[0].n, (await parts(contractId)).length);
  });

  test('identidad: nombre, RFC o CURP distintos, fiador ausente o nombrado sin parte, representantes y cardinalidad', async () => {
   const contractId = await contract();
   const wrongName = await snapshotFor(contractId); wrongName.fiador.nombre_completo = 'Otra Persona';
   await assert.rejects(verify(contractId, await document(contractId, { snapshot: wrongName })), /no identifica a la persona del rol FIADOR/);
   const wrongRfc = await snapshotFor(contractId); wrongRfc.arrendatario.rfc = 'XXXX000000XXX';
   await assert.rejects(verify(contractId, await document(contractId, { snapshot: wrongRfc })), /rol ARRENDATARIO/);
   const wrongRep = await snapshotFor(contractId); wrongRep.arrendador.representante.curp = 'OTRA';
   await assert.rejects(verify(contractId, await document(contractId, { snapshot: wrongRep })), /representante principal congelado/);
   const noGuarantor = await contract({ guarantor: false });
   const named = await snapshotFor(noGuarantor); named.fiador = personContext(await person(ids.guarantor));
   await assert.rejects(verify(noGuarantor, await document(noGuarantor, { snapshot: named })), /nombra un FIADOR que no es parte/);
   const okDoc = await document(noGuarantor);
   const { receipt, pdfSha } = await verify(noGuarantor, okDoc);
   await start(noGuarantor, okDoc, pdfSha, receipt);
   const twoTenants = await contract({ extraTenant: true });
   const snapshot = await snapshotFor(twoTenants);
   await assert.rejects(verify(twoTenants, await document(twoTenants, { snapshot })), /Cardinalidad de ARRENDATARIO fuera de la cobertura aprobada: 2 partes/);
   const doc = await document(contractId);
   await assert.rejects(verify(contractId, doc, { identities: (await identitiesFor(contractId)).map(x => x.rol === 'FIADOR' ? { ...x, persona_firmante_id: ids.joint, entidad_id: ids.joint } : x) }), /Identidades de firmantes no coinciden/);
   await h.inTransaction(async () => {
    await db.query("insert into representantes_persona_moral values(gen_random_uuid(),$1,$2,'APODERADO',true)", [ids.company, ids.tenant]);
    await assert.rejects(verify(contractId, doc), /exactamente un representante principal \(hay 2\)/);
   });
   await h.inTransaction(async () => {
    await db.query('update representantes_persona_moral set es_principal=false where persona_moral_id=$1', [ids.company]);
    await assert.rejects(verify(contractId, doc), /exactamente un representante principal \(hay 0\)/);
   });
  });

  test('recibo: actor, documento, hash, caducidad, reutilización y desfase de fuentes/HTML/contexto/plantilla', async () => {
   const contractId = await contract();
   const doc = await document(contractId, { version: 'v5' }); const other = await document(contractId, { version: 'v5' });
   for (const [overrides, pattern] of [
    [{ actor: ids.user }, /Administrador inválido/], [{ pdfSha: 'ABC' }, /SHA-256 inválido/], [{ bytes: 0 }, /Tamaño de PDF/],
    [{ renderer: ' ' }, /Revisión de renderer/], [{ htmlSha: sha('otro html') }, /HTML reconstruido diferente/],
    [{ templateSha: sha('otra plantilla') }, /versión de plantilla cambió/], [{ context: { contrato: {} } }, /contexto diferente/],
    [{ fuentes: { contrato: {} } }, /Fuentes cambiaron/]]) await assert.rejects(verify(contractId, doc, overrides), pattern);
   const { receipt, pdfSha } = await verify(contractId, doc);
   const otherReceipt = await verify(contractId, other);
   await assert.rejects(start(contractId, doc, pdfSha, receipt, ids.admin2), /Validación de PDF\/contexto/);
   await assert.rejects(start(contractId, doc, sha('otro pdf'), receipt), /Validación de PDF\/contexto/);
   await assert.rejects(start(contractId, doc, otherReceipt.pdfSha, otherReceipt.receipt), /Validación de PDF\/contexto/);
   await assert.rejects(start(contractId, doc, pdfSha, randomUUID()), /Validación de PDF\/contexto/);
   for (const [mutation, pattern] of [
    ["update personas set rfc='CAMBIO' where id='44444444-4444-4444-8444-444444444444'", /Fuentes cambiaron desde la verificación/],
    [`update versiones_plantilla set contenido='<p>editada</p>' where id='${ids.v5}'`, /versión de plantilla cambió desde la verificación/],
    [`update firma_privada.validaciones set expires_at=now()-interval '1 second' where id='${receipt}'`, /caducada/]]) {
    await h.inTransaction(async () => { await h.owner(() => db.exec(mutation)); await assert.rejects(start(contractId, doc, pdfSha, receipt), pattern); });
   }
   await start(contractId, doc, pdfSha, receipt);
   const processId = (await rows('select id from procesos_firma where contrato_id=$1', [contractId]))[0].id;
   await cancel(processId);
   await assert.rejects(start(contractId, doc, pdfSha, receipt), /Validación de PDF\/contexto/);
  });

  test('permisos: anon, no admin, sin sesión, service_role y escrituras directas', async () => {
   const contractId = await contract(); const doc = await document(contractId);
   const { receipt, pdfSha } = await verify(contractId, doc);
   await assert.rejects(h.as('anon', () => db.query('select iniciar_proceso_firma($1,$2,$3,$4)', [contractId, doc, pdfSha, receipt])), e => e.code === '42501');
   for (const sub of [ids.user, '']) await assert.rejects(start(contractId, doc, pdfSha, receipt, sub), e => e.code === '42501');
   await assert.rejects(h.admin(() => db.query('select firma_fuentes_para_verificar($1)', [contractId])), e => e.code === '42501');
   await assert.rejects(h.admin(() => db.query("select registrar_validacion_documento_firma($1,$2,$3,$4,1,'{}','{}',$4,$4,'r','[]')", [ids.admin, contractId, doc, 'a'.repeat(64)])), e => e.code === '42501');
   await assert.rejects(h.service(() => db.query('select iniciar_proceso_firma($1,$2,$3,$4)', [contractId, doc, pdfSha, receipt])), e => e.code === '42501');
   for (const role of ['authenticated', 'service_role']) {
    await assert.rejects(h.as(role, () => db.query('select * from firma_privada.validaciones'), ids.admin), e => e.code === '42501');
    await assert.rejects(h.as(role, () => db.query("select firma_privada.registrar_cobertura_plantilla($1,'x','[]','x')", [ids.v4]), ids.admin), e => e.code === '42501');
    for (const statement of ["insert into procesos_firma(contrato_id) values(gen_random_uuid())", 'update firmantes_proceso set estado=estado', 'delete from evidencias_firma'])
     await assert.rejects(h.as(role, () => db.exec(statement), ids.admin), e => e.code === '42501');
   }
   const privileges = (await rows(`select has_table_privilege('service_role','public.procesos_firma','INSERT') s, has_table_privilege('authenticated','public.firmantes_proceso','UPDATE') a,
    has_function_privilege('anon','public.iniciar_proceso_firma(uuid,uuid,text,uuid)','EXECUTE') f, has_function_privilege('authenticated','public.firma_fuentes_para_verificar(uuid)','EXECUTE') g`))[0];
   assert.deepEqual(privileges, { s: false, a: false, f: false, g: false });
   await start(contractId, doc, pdfSha, receipt);
   assert.ok((await h.admin(() => rows('select id from procesos_firma where contrato_id=$1', [contractId]))).length === 1);
   assert.equal((await h.admin(() => rows('select id from procesos_firma'), ids.user)).length, 0);
  });

  test('máquina de estados del contrato: lista blanca, inserción en BORRADOR y condiciones congeladas', async () => {
   const draft = await contract();
   for (const [target, pattern] of [['PENDIENTE_FIRMA', /requiere proceso atómico/], ['FIRMADO', /no permitida: BORRADOR -> FIRMADO/], ['ACTIVO', /no permitida/]])
    await assert.rejects(h.service(() => db.query(`update contratos set estado='${target}' where id=$1`, [draft])), pattern);
   await assert.rejects(h.owner(() => db.query("update contratos set estado='FIRMADO' where id=$1", [draft])), /no permitida/);
   await assert.rejects(h.service(() => db.query("insert into contratos(solicitud_id,unidad_id,folio,estado) values($1,1,'CTR-X','ACTIVO')", [randomUUID()])), /debe crearse en BORRADOR/);
   await assert.rejects(h.service(() => db.query("update contratos set estado='BORRADOR' where id=$1", [ids.legacy])), /no permitida: FIRMADO -> BORRADOR/);
   await assert.rejects(h.service(() => db.query('update contratos set renta=1 where id=$1', [ids.legacy])), /Condiciones congeladas/);
   await assert.rejects(h.service(() => db.query('delete from contratos where id=$1', [ids.legacy])), /Solo se eliminan contratos BORRADOR/);
   await h.inTransaction(async () => {
    await h.service(() => db.query("update contratos set estado='ACTIVO',updated_at=now() where id=$1", [ids.legacy]));
    await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
    await assert.rejects(h.service(() => db.query("update contratos set estado='FIRMADO' where id=$1", [ids.legacy])), /ACTIVO -> FIRMADO/);
   });
   const { contractId } = await pending();
   await assert.rejects(h.service(() => db.query("update contratos set estado='BORRADOR' where id=$1", [contractId])), /Solo cancelación controlada/);
   await assert.rejects(h.owner(() => db.query("update contratos set estado='FIRMADO' where id=$1", [contractId])), /PENDIENTE_FIRMA -> FIRMADO/);
   await assert.rejects(h.service(() => db.query("update contratos set fecha_firma='2026-12-01' where id=$1", [contractId])), /Condiciones congeladas/);
   // La edición de borrador de la app filtra estado=BORRADOR: no afecta filas en PENDIENTE_FIRMA.
   assert.equal((await h.admin(() => db.query("update contratos set renta=1 where id=$1 and estado='BORRADOR'", [contractId]))).affectedRows, 0);
   await h.admin(() => db.query("update contratos set renta=13000 where id=$1 and estado='BORRADOR'", [draft]));
  });

  test('invariante diferida: un proceso escrito a mano por el propietario sin firmantes no confirma', async () => {
   const contractId = await contract(); const doc = await document(contractId);
   const { receipt, pdfSha } = await verify(contractId, doc);
   await assert.rejects(h.owner(async () => {
    await db.exec('BEGIN');
    try {
     const [v] = await rows('select * from firma_privada.validaciones where id=$1', [receipt]);
     const [p] = await rows(`insert into procesos_firma(contrato_id,documento_origen_id,version_plantilla_id,validacion_id,sha256_documento_origen,size_bytes_origen,sha256_html,sha256_plantilla,
      revision_renderer,storage_path_origen,documento_snapshot,fuentes_snapshot,cobertura_snapshot,iniciado_por) values($1,$2,$3,$4,$5,1,$6,$7,'r','x','{}','{}','[]',$8) returning id`,
      [contractId, doc, ids.v2, receipt, pdfSha, v.sha256_html, v.sha256_plantilla, ids.admin]);
     await db.query("update documentos_contrato set tipo='PARA_FIRMA' where id=$1", [doc]);
     await db.query("update contratos set estado='PENDIENTE_FIRMA' where id=$1", [contractId]);
     await db.query('update firma_privada.validaciones set usado_por=$1 where id=$2', [p.id, receipt]);
     await db.exec('COMMIT');
    } catch (error) { await db.exec('ROLLBACK'); throw error; }
   }), /Proceso sin firmantes completos/);
   assert.equal(await contractState(contractId), 'BORRADOR');
  });

  test('documentos: contenido inmutable, ruta una vez, tipo solo por RPC, estado hacia delante', async () => {
   const contractId = await contract();
   const doc = await document(contractId, { attach: false });
   await assert.rejects(h.service(() => db.query("update documentos_contrato set storage_path='otra/ruta.pdf' where id=$1", [doc])), /ruta canónica/);
   await h.service(() => db.query("update documentos_contrato set storage_path=contrato_id::text||'/'||id::text||'/'||nombre_archivo where id=$1", [doc]));
   await assert.rejects(h.service(() => db.query("update documentos_contrato set storage_path=storage_path||'x' where id=$1", [doc])), /una sola vez/);
   await assert.rejects(h.service(() => db.query("update documentos_contrato set contenido_renderizado='<p>x</p>' where id=$1", [doc])), /inmutables/);
   await assert.rejects(h.service(() => db.query("update documentos_contrato set datos_snapshot='{}' where id=$1", [doc])), /inmutables/);
   await assert.rejects(h.service(() => db.query("update documentos_contrato set version_plantilla_id=$2 where id=$1", [doc, ids.v3])), /inmutables/);
   for (const tipo of ['PARA_FIRMA', 'FIRMADO']) await assert.rejects(h.service(() => db.query(`update documentos_contrato set tipo='${tipo}' where id=$1`, [doc])), /solo mediante el inicio de firma/);
   await assert.rejects(h.service(() => db.query("insert into documentos_contrato(contrato_id,tipo,estado) values($1,'PARA_FIRMA','GENERADO')", [contractId])), /se crea BORRADOR\/GENERADO/);
   const spare = await document(contractId);
   await h.service(() => db.query("update documentos_contrato set estado='ANULADO' where id=$1", [spare]));
   await assert.rejects(h.service(() => db.query("update documentos_contrato set estado='GENERADO' where id=$1", [spare])), /ANULADO -> GENERADO/);
   await assert.rejects(verify(contractId, spare), /estado ANULADO/);
   const { receipt, pdfSha } = await verify(contractId, doc);
   await start(contractId, doc, pdfSha, receipt);
   await assert.rejects(h.service(() => db.query("update documentos_contrato set estado='ENVIADO' where id=$1", [doc])), /origen inmutable/);
   await assert.rejects(h.service(() => db.query('delete from documentos_contrato where id=$1', [doc])), /origen inmutable/);
   await assert.rejects(h.service(() => db.query('delete from documentos_contrato where id=$1', [spare])), /conservados fuera de BORRADOR/);
   await assert.rejects(document(contractId), /solo en BORRADOR/);
  });

  test('partes: congeladas fuera de BORRADOR; borrado en cascada de un BORRADOR permitido', async () => {
   const { contractId } = await pending();
   for (const statement of ['update partes_contrato set updated_at=now() where contrato_id=$1', 'delete from partes_contrato where contrato_id=$1 and rol=\'FIADOR\'',
    `insert into partes_contrato(contrato_id,persona_id,rol) values($1,'${ids.joint}','OBLIGADO_SOLIDARIO')`])
    await assert.rejects(h.owner(() => db.query(statement, [contractId])), /Partes congeladas fuera de BORRADOR/);
   await assert.rejects(h.admin(() => db.query("select cambiar_arrendador_contrato_borrador($1,'PERSONA',$2)", [contractId, ids.landlordPerson])), /BORRADOR/);
   await assert.rejects(h.owner(() => db.query('delete from contratos where id=$1', [contractId])), /historial de firma/);
   const draft = await contract();
   assert.equal((await parts(draft)).length, 3);
   await h.owner(() => db.query('delete from contratos where id=$1', [draft]));
   assert.equal((await parts(draft)).length, 0);
  });

  test('FK reales: BORRADOR con documentos (RESTRICT) se borra retirándolos antes; TRUNCATE no esquiva los triggers 2C', async () => {
   const draft = await contract(); const doc = await document(draft);
   await assert.rejects(h.service(() => db.query('delete from contratos where id=$1', [draft])), /foreign key/);
   await h.service(() => db.query('delete from documentos_contrato where id=$1', [doc]));
   await h.service(() => db.query('delete from contratos where id=$1', [draft]));
   assert.equal((await parts(draft)).length, 0);
   // Supabase concede TRUNCATE a los roles cliente en las tablas existentes; TRUNCATE no dispara triggers de fila.
   for (const table of ['contratos', 'partes_contrato', 'documentos_contrato', 'versiones_plantilla']) {
    await h.inTransaction(() => assert.rejects(h.service(() => db.exec(`truncate ${table}`)), /foreign key/));
    await h.inTransaction(() => assert.rejects(h.service(() => db.exec(`truncate ${table} cascade`)), e => e.code === '42501'));
   }
  });

  test('cancelación: motivo, autor, contrato a BORRADOR, documento conservado y reutilizable con nuevo recibo', async () => {
   const { contractId, documentId, processId, pdfSha } = await pending();
   for (const reason of ['', '   ', 'x'.repeat(1001)]) await assert.rejects(cancel(processId, reason), /Motivo obligatorio/);
   await assert.rejects(cancel(processId, 'motivo', ids.user), e => e.code === '42501');
   await assert.rejects(cancel(randomUUID()), /Proceso inexistente/);
   await cancel(processId, '  Datos del fiador erróneos ');
   const process = (await rows('select estado,cancelado_por,motivo_cancelacion from procesos_firma where id=$1', [processId]))[0];
   assert.deepEqual(process, { estado: 'CANCELADO', cancelado_por: ids.admin, motivo_cancelacion: 'Datos del fiador erróneos' });
   assert.equal(await contractState(contractId), 'BORRADOR');
   assert.equal((await rows('select tipo::text t from documentos_contrato where id=$1', [documentId]))[0].t, 'PARA_FIRMA');
   await assert.rejects(cancel(processId), /no pendiente/);
   await assert.rejects(h.owner(() => db.query("update procesos_firma set estado='PENDIENTE',cancelado_at=null,cancelado_por=null,motivo_cancelacion=null where id=$1", [processId])), /Solo cancelación controlada/);
   await assert.rejects(h.owner(() => db.query('delete from procesos_firma where id=$1', [processId])), /No se elimina/);
   await assert.rejects(h.owner(() => db.query("update firmantes_proceso set caracter='otro' where proceso_firma_id=$1", [processId])), /Firmantes congelados/);
   const again = await verify(contractId, documentId);
   const second = await start(contractId, documentId, again.pdfSha, again.receipt);
   assert.notEqual(second, processId); assert.equal(again.pdfSha, pdfSha);
   await cancel(second);
   await h.admin(() => db.query("select cambiar_arrendador_contrato_borrador($1,'PERSONA',$2)", [contractId, ids.landlordPerson]));
   await assert.rejects(verify(contractId, documentId), /Fuentes cambiaron|no identifica/);
  });

  test('versión de plantilla congelada tras el inicio; cobertura validada contra su SHA-256', async () => {
   await pending();
   await assert.rejects(h.owner(() => db.query("update versiones_plantilla set contenido='<p>x</p>' where id=$1", [ids.v2])), /contenido inmutable/);
   await assert.rejects(h.owner(() => db.query('delete from versiones_plantilla where id=$1', [ids.v2])), /no se elimina/);
   await h.inTransaction(() => h.owner(() => db.query("update versiones_plantilla set estado='PUBLICADA' where id=$1", [ids.v2])));
   const register = roles => h.owner(() => db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,$3::jsonb,'ok')", [ids.v4, sha(HTML.v4), JSON.stringify(roles)]));
   await assert.rejects(h.owner(() => db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,'[]','ok')", [ids.v4, sha('otro')])), /SHA-256 aprobado/);
   await assert.rejects(register([{ rol: 'ARRENDADOR', minimo: 1, maximo: 1, entidades: ['PERSONA'] }]), /ARRENDADOR y ARRENDATARIO/);
   await assert.rejects(register([...COVERAGE.v2.slice(0, 2), { rol: 'FIADOR', minimo: 0, maximo: 2, entidades: ['PERSONA'] }]), /check constraint/);
   await assert.rejects(register([...COVERAGE.v2.slice(0, 2), { rol: 'FIADOR', minimo: 0, maximo: 1, entidades: ['PERSONA_MORAL'] }]), /check constraint/);
   // Contenido cambiado después de aprobar la cobertura: la versión deja de ser elegible.
   await h.inTransaction(async () => {
    const contractId = await contract(); const doc = await document(contractId, { version: 'v6' });
    await h.owner(() => db.query("update versiones_plantilla set contenido='<p>v6 editada</p>' where id=$1", [ids.v6]));
    await assert.rejects(verify(contractId, doc), /cambió después de aprobar su cobertura/);
   });
  });

  test('atomicidad: si falla un firmante no queda proceso, estado ni recibo consumido', async () => {
   const contractId = await contract(); const doc = await document(contractId);
   const { receipt, pdfSha } = await verify(contractId, doc);
   await h.owner(() => db.exec("create function public.fixture_falla_firmante() returns trigger language plpgsql as $$begin if new.rol='FIADOR' then raise exception 'fallo simulado'; end if; return new; end$$; create trigger fixture_falla before insert on firmantes_proceso for each row execute function public.fixture_falla_firmante();"));
   try { await assert.rejects(start(contractId, doc, pdfSha, receipt), /fallo simulado/); }
   finally { await h.owner(() => db.exec('drop trigger fixture_falla on firmantes_proceso; drop function public.fixture_falla_firmante();')); }
   assert.equal(await contractState(contractId), 'BORRADOR');
   assert.equal((await rows('select count(*)::int n from procesos_firma where contrato_id=$1', [contractId]))[0].n, 0);
   assert.equal((await rows('select tipo::text t from documentos_contrato where id=$1', [doc]))[0].t, 'BORRADOR');
   assert.equal((await h.owner(() => rows('select usado_por from firma_privada.validaciones where id=$1', [receipt])))[0].usado_por, null);
   await start(contractId, doc, pdfSha, receipt);
  });

  test('bloqueos: solo de fila sobre fuentes; sin LOCK TABLE ni NOWAIT', async () => {
   assert.doesNotMatch(INSTALLER.replace(/--[^\n]*/g, ''), /LOCK TABLE|NOWAIT/i);
   const contractId = await contract(); const doc = await document(contractId);
   const { receipt, pdfSha } = await verify(contractId, doc);
   await h.inTransaction(async () => {
    await start(contractId, doc, pdfSha, receipt);
    const locks = await rows(`select c.relname,l.mode from pg_locks l join pg_class c on c.oid=l.relation
     where l.locktype='relation' and c.relname in('personas','personas_morales','representantes_persona_moral','unidades','edificios','versiones_plantilla')`);
    assert.ok(locks.length > 0);
    assert.deepEqual([...new Set(locks.map(l => l.mode))].filter(mode => !['AccessShareLock', 'RowShareLock'].includes(mode)), []);
   });
  });

  test('compatibilidad 2B.0: RPC de 6 y 8 argumentos, puente del arrendador y cambio en BORRADOR', async () => {
   const app = randomUUID();
   await db.query("insert into solicitudes values($1,1,'aprobada')", [app]);
   await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'solicitante')", [app, ids.tenant]);
   const old = (await h.admin(() => rows("select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,12000::numeric,12000::numeric,1::integer) id", [app])))[0].id;
   assert.deepEqual((await parts(old)).map(p => p.rol).sort(), ['ARRENDADOR', 'ARRENDATARIO']);
   const draft = await contract({ joint: true });
   assert.deepEqual((await parts(draft)).map(p => p.rol).sort(), ['ARRENDADOR', 'ARRENDATARIO', 'FIADOR', 'OBLIGADO_SOLIDARIO']);
   await h.admin(() => db.query("select cambiar_arrendador_contrato_borrador($1,'PERSONA',$2)", [draft, ids.landlordPerson]));
   await h.admin(() => db.query("select cambiar_arrendador_contrato_borrador($1,'PERSONA_MORAL',$2)", [draft, ids.company]));
   await assert.rejects(h.owner(() => db.query("delete from partes_contrato where contrato_id=$1 and rol='ARRENDADOR'", [draft])), /exactamente un ARRENDADOR/);
  });
 });
}

suite('estado/tipo text', { enums: false });
suite('estado/tipo enum', { enums: true });

describe('preflight de instalación', () => {
 let db, h;
 before(async () => { db = await baseDb(); h = helpers(db); });
 after(async () => db.close());
 const install = role => (role ? h.as(role, () => db.exec(INSTALLER)) : db.exec(INSTALLER)).finally(h.abort);
 test('rechaza roles cliente, instalador no propietario y PENDIENTE_FIRMA sin proceso', async () => {
  await assert.rejects(install('authenticated'), /propietario confiable BYPASSRLS/);
  await assert.rejects(install('service_role'), /Rol de instalación no permitido/);
  await assert.rejects(install(null), /debe ser propietario/);
  await db.query("update contratos set estado='PENDIENTE_FIRMA' where id=$1", [ids.legacy]);
  await assert.rejects(install('propietario_sim'), /pendientes sin proceso 2C/);
  assert.equal((await db.query("select to_regnamespace('firma_privada') n")).rows[0].n, null);
 });
 test('las verificaciones adicionales son de solo lectura y ejecutan sobre el esquema instalado', async () => {
  const queries = read('../docs/sql/firmas-2c/03_verificaciones_adicionales_solo_lectura.sql');
  assert.doesNotMatch(queries.replace(/--[^\n]*/g, ''), /\b(UPDATE|DELETE|INSERT|ALTER|CREATE|DROP|GRANT|REVOKE|CALL|TRUNCATE|LOCK)\b/i);
  await db.query("update contratos set estado='FIRMADO' where id=$1", [ids.legacy]);
  await h.owner(() => db.exec(INSTALLER));
  await db.exec(queries);
 });
});

describe('instalación frente a pertenencia a roles y privilegios predeterminados de Supabase', () => {
 let db, h;
 before(async () => { db = await baseDb(); h = helpers(db); await db.exec('CREATE ROLE dashboard_sim; CREATE ROLE cli_login_sim; GRANT propietario_sim TO cli_login_sim;'); });
 after(async () => db.close());
 const install = () => h.owner(() => db.exec(INSTALLER)).finally(h.abort);
 const installed = async () => (await db.query("select to_regnamespace('firma_privada') n")).rows[0].n !== null;
 test('rechaza un rol cliente miembro del instalador', async () => {
  await db.exec('GRANT propietario_sim TO service_role');
  try { await assert.rejects(install(), /rol cliente es miembro/); } finally { await db.exec('REVOKE propietario_sim FROM service_role'); }
  assert.equal(await installed(), false);
 });
 test('aborta ante privilegios predeterminados no previstos y no deja objetos', async () => {
  await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE propietario_sim IN SCHEMA public GRANT SELECT ON TABLES TO dashboard_sim');
  try { await assert.rejects(install(), /Privilegios inesperados tras instalar 2C: .*dashboard_sim/); }
  finally { await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE propietario_sim IN SCHEMA public REVOKE SELECT ON TABLES FROM dashboard_sim'); }
  assert.equal(await installed(), false);
 });
 test('instala con un operador miembro (cli_login_postgres); sin SET ROLE no escribe directo y los clientes no heredan nada', async () => {
  await install();
  assert.equal(await installed(), true);
  await assert.rejects(h.as('cli_login_sim', () => db.exec('insert into procesos_firma(contrato_id) values(gen_random_uuid())')), /solo mediante RPC/);
  await h.abort();
  const all = 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN';
  for (const table of ['procesos_firma', 'firmantes_proceso', 'evidencias_firma']) {
   const r = (await db.query(`select has_table_privilege('anon','public.${table}','${all}') anon,
    has_table_privilege('authenticated','public.${table}','${all.replace('SELECT,', '')}') auth, has_table_privilege('service_role','public.${table}','${all.replace('SELECT,', '')}') svc`)).rows[0];
   assert.deepEqual(r, { anon: false, auth: false, svc: false }, table);
  }
 });
});

describe('auditoría del original 01_infraestructura.sql (documento histórico)', () => {
 let db, h;
 before(async () => { db = await baseDb(); h = helpers(db); });
 after(async () => db.close());
 test('no compila: comillas $ en comprobar_transicion y CASE dentro de IF en proteger_firmante', async () => {
  await assert.rejects(h.owner(() => db.exec(ORIGINAL)), e => e.code === '42601'); await h.abort();
  const dollar = ORIGINAL.replace(/AS \$(\r?\nDECLARE cid uuid; state text; amount)/, (_, rest) => 'AS $$' + rest).replace(/END \$;/, () => 'END $$;');
  await assert.rejects(h.owner(() => db.exec(dollar)), e => e.code === '42601' && /end of input/.test(e.message)); await h.abort();
  const minimal = dollar.replace("IS DISTINCT FROM CASE WHEN part.persona_id IS NOT NULL THEN 'PERSONA' ELSE 'PERSONA_MORAL' END", "IS DISTINCT FROM (CASE WHEN part.persona_id IS NOT NULL THEN 'PERSONA' ELSE 'PERSONA_MORAL' END)");
  await h.owner(() => db.exec(minimal));
  // Con solo esas dos correcciones persiste el hueco de cascada: borrar un BORRADOR falla.
  const app = randomUUID();
  await db.query("insert into solicitudes values($1,1,'aprobada')", [app]);
  await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'solicitante')", [app, ids.tenant]);
  const id = (await h.admin(() => db.query("select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,1::numeric,0::numeric,1::integer,'PERSONA_MORAL',$2::uuid) id", [app, ids.company]))).rows[0].id;
  await assert.rejects(h.owner(() => db.query('delete from contratos where id=$1', [id])), /Partes congeladas fuera de BORRADOR/);
 });
});
