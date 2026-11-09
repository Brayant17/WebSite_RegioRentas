import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import pngjs from 'pngjs';
import { build as viteBuild } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright-core';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
// Flujo del firmante con las RPC reales de 07 en PGlite, las rutas HTTP reales, PDF y PNG reales, y el cliente real de
// Supabase Storage contra un servidor local. Con Chromium, la página real en un navegador real. Jamás contra Supabase.
registerHooks({ resolve(specifier, context, next) {
 if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
 if (context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !/\.tsx?$/.test(specifier)) return next(`${specifier}.ts`, context);
 return next(specifier, context);
} });
const mod = '../src/modules/admin/arrendamiento/contratos/';
const { createSignerFlowService, otpHmac, hashInvitationToken } = await import(`${mod}firmas/server/signerFlowService.ts`);
const { createInvitationService } = await import(`${mod}firmas/server/invitationService.ts`);
const { signerRepository, invitationRepository } = await import(`${mod}firmas/server/signerRepository.ts`);
const signer = await import(`${mod}firmas/server/signerRequest.ts`);
const { handleSignatureInvitationListRequest, handleSignatureInvitationRequest } = await import(`${mod}firmas/server/request.ts`);
const { consoleOtpDelivery, selectOtpDelivery } = await import(`${mod}firmas/server/otpDelivery.ts`);
const { createSigningService } = await import(`${mod}firmas/server/signingService.ts`);
const { createFinalPdfService } = await import(`${mod}firmas/server/finalPdfService.ts`);
const { finalPdfRepository, signingRepository } = await import(`${mod}firmas/server/finalPdfRepository.ts`);
const { validateDrawnSignature } = await import(`${mod}firmas/server/drawnSignature.ts`);
const { privatePdfStorage } = await import(`${mod}documentos/server/storage/privateStorage.ts`);
const { PdfError } = await import(`${mod}documentos/server/errors.ts`);

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const STAGE1 = read('../docs/sql/firmas-2c/02_infraestructura_corregida.sql');
const ESF = read('../docs/sql/firmas-2c/07_firma_electronica_simple.sql');
const SECRET = 'secreto-de-servidor-solo-para-pruebas-de-otp';
const SITE = 'https://regiorentas.test';
const ids = {
 admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', company: '22222222-2222-4222-8222-222222222222', rep: '11111111-1111-4111-8111-111111111111',
 tenant: '33333333-3333-4333-8333-333333333333', guarantor: '44444444-4444-4444-8444-444444444444', template: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', v2: 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2',
};
const MAILS = { [ids.rep]: 'representante@example.com', [ids.tenant]: 'inquilino@example.com', [ids.guarantor]: 'fiador@example.com' };
const HTML_V2 = '<p>{{arrendador.bloques.firma}} {{arrendatario.nombre_completo}} {{fiador.nombre_completo}}</p>';
const COVERAGE = [{ rol: 'ARRENDADOR', minimo: 1, maximo: 1, entidades: ['PERSONA_MORAL'] }, { rol: 'ARRENDATARIO', minimo: 1, maximo: 1, entidades: ['PERSONA'] }, { rol: 'FIADOR', minimo: 0, maximo: 1, entidades: ['PERSONA'] }];
const STORAGE_SQL = `
CREATE ROLE storage_admin_sim NOLOGIN;
CREATE SCHEMA storage AUTHORIZATION storage_admin_sim;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets,name text,owner uuid,
 owner_id text,metadata jsonb,version text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),last_accessed_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
INSERT INTO storage.buckets VALUES('contract-documents','contract-documents',false,10485760,'{application/pdf}');
ALTER TABLE storage.buckets OWNER TO storage_admin_sim; ALTER TABLE storage.objects OWNER TO storage_admin_sim;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO propietario_sim,anon,authenticated,service_role;
GRANT SELECT ON storage.buckets,storage.objects TO propietario_sim;`;

function scribbleBase64(width = 1000, height = 400) {
 const png = new pngjs.PNG({ width, height });
 png.data.fill(0);
 for (let x = 20; x < width - 20; x++) {
  const y = Math.round(height / 2 + Math.sin(x / 25) * (height / 3));
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const i = ((y + dy) * width + x + dx) * 4; png.data[i] = 15; png.data[i + 1] = 15; png.data[i + 2] = 15; png.data[i + 3] = 255; }
 }
 return pngjs.PNG.sync.write(png).toString('base64');
}
const blankBase64 = () => { const png = new pngjs.PNG({ width: 1000, height: 400 }); png.data.fill(0); return pngjs.PNG.sync.write(png).toString('base64'); };
async function realPdf(pages = 2) {
 const doc = await PDFDocument.create();
 const font = await doc.embedFont(StandardFonts.Helvetica);
 for (let n = 1; n <= pages; n++) doc.addPage([612, 792]).drawText(`Clausula del contrato, pagina ${n} ${randomUUID()}`, { x: 60, y: 700, size: 12, font });
 return doc.save();
}

describe('flujo del firmante por HTTP con las RPC de 07', () => {
 let db, storageServer, app, storage, flow, signerDeps, codeOutbox;
 const objects = new Map();
 let queue = Promise.resolve();
 const exclusive = fn => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };
 const sql = (text, params = []) => exclusive(async () => (await db.query(text, params)).rows);
 const asRole = (role, text, params = [], sub) => exclusive(async () => {
  if (sub) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
  await db.exec(`set role ${role}`);
  try { return (await db.query(text, params)).rows; } finally { await db.exec('reset role'); }
 });
 const bypass = (text, params = []) => exclusive(async () => {
  await db.exec('SET session_replication_role=replica');
  try { return (await db.query(text, params)).rows; } finally { await db.exec('SET session_replication_role=origin'); }
 });
 const rpcCalls = [];
 const client = () => ({
  storage: storageClient.storage,
  rpc: async (name, args) => {
   rpcCalls.push({ name, args });
   const keys = Object.keys(args);
   try { return { data: (await asRole('service_role', `select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(',')}) r`, keys.map(k => args[k])))[0].r, error: null }; }
   catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  },
  from: table => ({ select: columns => ({ eq: (column, value) => ({ maybeSingle: async () => ({ data: (await sql(`select ${columns} from ${table} where ${column}=$1`, [value]))[0] ?? null, error: null }) }) }) }),
 });
 let storageClient;
 const otpDelivery = () => ({ deliver(message) { codeOutbox.push(message); } });

 function startStorage() {
  return new Promise(resolve => {
   storageServer = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice('/storage/v1/object/contract-documents/'.length));
    const reply = (status, payload, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(type === 'application/json' ? JSON.stringify(payload) : payload); };
    if (req.method === 'GET') { const object = objects.get(path); return object ? reply(200, object, 'application/pdf') : reply(400, { statusCode: '404', error: 'not_found', message: 'Object not found' }); }
    if (objects.has(path) && req.headers['x-upsert'] !== 'true') return reply(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
    objects.set(path, body);
    await sql("insert into storage.objects(bucket_id,name,metadata) values('contract-documents',$1,$2::jsonb) on conflict(bucket_id,name) do update set metadata=excluded.metadata", [path, JSON.stringify({ size: body.length, mimetype: req.headers['content-type'], eTag: `"${createHash('md5').update(body).digest('hex')}"` })]);
    return reply(200, { Id: randomUUID(), Key: `contract-documents/${path}` });
   });
   storageServer.listen(0, '127.0.0.1', () => resolve(storageServer.address().port));
  });
 }

 before(async () => {
  db = new PGlite();
  await db.exec(read('./fixtures/partes-schema.sql').replaceAll('fixture_contract_folio_seq', 'contratos_folio_seq'));
  await db.exec(read('../docs/sql/partes-2b0/01_esquema.sql'));
  const hash = (await db.query("select md5(pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure)) h")).rows[0].h;
  await db.exec(read('../docs/sql/partes-2b0/02_rpc.sql').replace('c1e2e7ed4a9dd613bbbbe06f4dae50b7', hash));
  await db.exec(read('./fixtures/firmas-2c-schema.sql'));
  await db.exec(STORAGE_SQL);
  await db.exec('set role propietario_sim'); await db.exec(STAGE1); await db.exec('reset role');
  await db.query("insert into versiones_plantilla values($1,$2,2,'BORRADOR',$3)", [ids.v2, ids.template, HTML_V2]);
  await db.exec('set role propietario_sim');
  await db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,$3::jsonb,'Aprobación jurídica de prueba')", [ids.v2, sha(HTML_V2), JSON.stringify(COVERAGE)]);
  await db.exec(ESF); await db.exec('reset role');
  for (const [id, mail] of Object.entries(MAILS)) await db.query('update personas set correo=$1 where id=$2', [mail, id]);
  storageClient = createClient(`http://127.0.0.1:${await startStorage()}`, 'clave-de-prueba', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const c = client();
  storage = privatePdfStorage(c);
  flow = createSignerFlowService({ repository: signerRepository(c), storage, signing: createSigningService(signingRepository(c), createFinalPdfService(finalPdfRepository(c), storage)), otpSecret: () => SECRET, otpDelivery });
  signerDeps = { service: () => flow };
  app = c;
  codeOutbox = [];
 });
 after(async () => { storageServer.close(); await db.close(); });

 // ---------------------------------------------------------------- datos
 const text = value => { const t = value == null ? '' : String(value).trim().replace(/\s+/g, ' '); return /^(null|undefined)$/i.test(t) ? '' : t; };
 const fullName = p => (p ? [p.nombre, p.apellido_paterno, p.apellido_materno].map(text).filter(Boolean).join(' ') : '');
 const personContext = p => ({ nombre_completo: fullName(p), rfc: text(p?.rfc), curp: text(p?.curp) });
 const person = async id => (await sql('select * from personas where id=$1', [id]))[0];
 const parts = contractId => sql('select id,rol::text rol,persona_id,persona_moral_id from partes_contrato where contrato_id=$1 order by id', [contractId]);

 async function pending({ guarantor = false } = {}) {
  const solicitud = randomUUID();
  await sql("insert into solicitudes values($1,1,'aprobada')", [solicitud]);
  await sql("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'solicitante')", [solicitud, ids.tenant]);
  if (guarantor) await sql("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'fiador')", [solicitud, ids.guarantor]);
  const contractId = (await asRole('authenticated', "select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,12000::numeric,12000::numeric,1::integer,'PERSONA_MORAL'::text,$2::uuid) id", [solicitud, ids.company], ids.admin))[0].id;
  const list = await parts(contractId);
  const company = (await sql('select * from personas_morales where id=$1', [ids.company]))[0];
  const rep = (await sql('select * from representantes_persona_moral where persona_moral_id=$1 and es_principal order by id', [ids.company]))[0];
  const slot = async role => { const part = list.find(p => p.rol === role); return personContext(part ? await person(part.persona_id) : null); };
  const context = { arrendador: { tipo: 'PERSONA_MORAL', razon_social: text(company.razon_social), representante: personContext(await person(rep.persona_id)) }, arrendatario: await slot('ARRENDATARIO'), fiador: await slot('FIADOR') };
  const html = `<p>${context.arrendatario.nombre_completo}</p>`;
  const documentId = (await asRole('authenticated', `insert into documentos_contrato(contrato_id,version_plantilla_id,numero_version,tipo,estado,nombre_archivo,datos_snapshot,contenido_renderizado,generated_at)
   values($1,$2,1,'BORRADOR','GENERADO','CTR-prueba-v1.pdf',$3::jsonb,$4,now()) returning id`, [contractId, ids.v2, JSON.stringify(context), html], ids.admin))[0].id;
  const path = `${contractId}/${documentId}/CTR-prueba-v1.pdf`;
  await asRole('service_role', 'update documentos_contrato set storage_path=$2 where id=$1', [documentId, path]);
  const bytes = Buffer.from(await realPdf(2));
  objects.set(path, bytes);
  const pdfSha = sha(bytes);
  const fuentes = (await asRole('service_role', 'select firma_fuentes_para_verificar($1) f', [contractId]))[0].f;
  const identities = list.map(part => {
   const base = { parte_contrato_id: part.id, rol: part.rol, referencia_documento: part.rol.toLowerCase() };
   return part.persona_moral_id ? { ...base, entidad_tipo: 'PERSONA_MORAL', entidad_id: part.persona_moral_id, persona_firmante_id: rep.persona_id, representante_origen_id: rep.id }
    : { ...base, entidad_tipo: 'PERSONA', entidad_id: part.persona_id, persona_firmante_id: part.persona_id, representante_origen_id: null };
  });
  const receipt = (await asRole('service_role', 'select registrar_validacion_documento_firma($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb) id',
   [ids.admin, contractId, documentId, pdfSha, bytes.length, JSON.stringify(fuentes), JSON.stringify(context), sha(html), sha(HTML_V2), 'renderer-prueba', JSON.stringify(identities)]))[0].id;
  const processId = (await asRole('authenticated', 'select iniciar_proceso_firma($1,$2,$3,$4) id', [contractId, documentId, pdfSha, receipt], ids.admin))[0].id;
  const signers = await sql('select id,rol,persona_firmante_id from firmantes_proceso where proceso_firma_id=$1 order by rol', [processId]);
  return { contractId, documentId, processId, pdfSha, signers, originPath: path, bytes };
 }

 // ---------------------------------------------------------------- peticiones
 const invitationDeps = (overrides = {}) => ({ authorize: async () => ids.admin, service: () => createInvitationService(invitationRepository(app), overrides.site ?? (() => SITE)), ...overrides.deps });
 const inviteRequest = (p, signerId, options = {}) => handleSignatureInvitationRequest(new Request(options.url ?? 'http://host-de-la-peticion/api', { method: options.method ?? 'POST', headers: { 'Content-Type': 'application/json', ...options.headers }, body: JSON.stringify({ firmanteId: signerId, ...options.body }) }),
  options.contractId ?? p.contractId, p.processId, invitationDeps(options));
 const codeFrom = message => message.code;
 async function invite(p, signerId) {
  const response = await inviteRequest(p, signerId);
  assert.equal(response.status, 200, await response.clone().text());
  return new URL((await response.json()).enlace).hash.slice(3);
 }
 const call = (handler, token, body, init = {}) => handler(new Request('https://regiorentas.test/api/firma/x', { method: init.method ?? 'POST',
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), init.deps ?? signerDeps);
 const session = (token, init) => call(signer.handleSignerSessionRequest, token, undefined, init);
 const documentOf = (token, init) => call(signer.handleSignerDocumentRequest, token, undefined, init);
 const consent = (token, p, overrides = {}) => call(signer.handleSignerConsentRequest, token, { sha256Documento: p.pdfSha, version: 'CONSENTIMIENTO_FES_V2', acepta: true, ...overrides });
 const requestCode = (token, init) => call(signer.handleSignerCodeRequest, token, undefined, init);
 const sign = (token, p, code, overrides = {}, init) => call(signer.handleSignerSignRequest, token, { codigo: code, sha256Documento: p.pdfSha, firmaPng: scribbleBase64(), confirmacion: true, ...overrides }, init);
 const errorCode = async response => (await response.json()).error.code;
 async function toCodeStep(p, signerId) {
  const token = await invite(p, signerId);
  await documentOf(token);
  assert.equal((await consent(token, p)).status, 200);
  codeOutbox.length = 0;
  assert.equal((await requestCode(token)).status, 200);
  return { token, code: codeFrom(codeOutbox[0]) };
 }
 const allowResend = token => bypass("update firma_privada.otps_firma o set emitido_at=o.emitido_at-interval '2 minutes',expira_at=o.expira_at-interval '2 minutes' from firma_privada.invitaciones_firma i where o.invitacion_id=i.id and i.token_hash=$1", [hashInvitationToken(token)]);
 const expireOtp = token => bypass("update firma_privada.otps_firma o set emitido_at=o.emitido_at-interval '11 minutes',expira_at=o.expira_at-interval '11 minutes' from firma_privada.invitaciones_firma i where o.invitacion_id=i.id and i.token_hash=$1", [hashInvitationToken(token)]);
 const invitation = async token => (await sql('select * from firma_privada.invitaciones_firma where token_hash=$1', [hashInvitationToken(token)]))[0];
 const events = async (token, type) => (await sql('select e.* from firma_privada.eventos_firma e join firma_privada.invitaciones_firma i on i.id=e.invitacion_id where i.token_hash=$1 and e.tipo=$2', [hashInvitationToken(token), type]));
 const otps = async token => sql('select o.* from firma_privada.otps_firma o join firma_privada.invitaciones_firma i on i.id=o.invitacion_id where i.token_hash=$1 order by o.emitido_at', [hashInvitationToken(token)]);
 const wrongCode = code => (code === '000000' ? '000001' : '000000');

 // ---------------------------------------------------------------- invitaciones
 test('invitación: el enlace sale solo en la respuesta, con el sitio configurado; a la base llega solo el hash', async () => {
  const p = await pending();
  codeOutbox.length = 0;
  const response = await inviteRequest(p, p.signers[0].id, { body: { correo: 'atacante@example.com' }, headers: { host: 'atacante.example.com' }, url: 'https://atacante.example.com/api' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['enlace', 'expiraAt']);
  assert.ok(!JSON.stringify(body).includes(MAILS[p.signers[0].persona_firmante_id]));
  const link = new URL(body.enlace);
  assert.equal(link.origin, SITE); assert.equal(link.pathname, '/firmar'); assert.equal(link.search, '');
  const token = link.hash.slice(3);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const stored = await invitation(token);
  assert.equal(stored.token_hash, sha(token)); assert.ok(!JSON.stringify(stored).includes(token));
  assert.equal(stored.correo, MAILS[p.signers[0].persona_firmante_id], 'el correo congelado sigue en la evidencia');
  assert.equal(codeOutbox.length, 0, 'generar el enlace no emite códigos');
 });

 test('consulta de invitaciones: estado de la última de cada firmante, sin enlace ni token, y solo para el administrador', async () => {
  const p = await pending();
  const list = (options = {}) => handleSignatureInvitationListRequest(new Request('http://x/a', { method: options.method ?? 'GET' }), options.contractId ?? p.contractId, p.processId, invitationDeps(options));
  assert.deepEqual((await (await list()).json()).invitaciones, []);
  const [signer] = p.signers;
  const first = await invite(p, signer.id);
  const second = await invite(p, signer.id);
  const response = await list();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const raw = await response.text();
  for (const secret of [first, second, sha(first), sha(second)]) assert.ok(!raw.includes(secret), 'sin token ni hash');
  const { invitaciones } = JSON.parse(raw);
  assert.equal(invitaciones.length, 1, 'solo la última del firmante');
  assert.deepEqual(Object.keys(invitaciones[0]).sort(), ['emitidaAt', 'estado', 'expiraAt', 'firmanteId']);
  assert.deepEqual([invitaciones[0].firmanteId, invitaciones[0].estado], [signer.id, 'VIGENTE']);
  const service = invitationDeps().service();
  const later = await service.list({ actorId: ids.admin, contractId: p.contractId, processId: p.processId }, new Date(invitaciones[0].expiraAt).getTime() + 1);
  assert.equal(later.invitaciones[0].estado, 'VENCIDA');
  assert.equal((await list({ method: 'POST' })).status, 405);
  assert.equal(await errorCode(await list({ contractId: '99999999-9999-4999-8999-999999999999' })), 'PROCESS_NOT_FOUND');
  let built = 0;
  const denied = await handleSignatureInvitationListRequest(new Request('http://x/a'), p.contractId, p.processId, { authorize: async () => { throw new PdfError(401, 'UNAUTHENTICATED', 'Inicia sesión'); }, service: () => { built++; } });
  assert.equal(denied.status, 401); assert.equal(built, 0);
  const { token, code } = await toCodeStep(p, signer.id);
  assert.equal((await sign(token, p, code)).status, 200);
  assert.equal((await (await list()).json()).invitaciones[0].estado, 'USADA');
 });

 test('una invitación nueva invalida el enlace anterior', async () => {
  const p = await pending();
  const first = await invite(p, p.signers[0].id);
  assert.equal((await session(first)).status, 200);
  const second = await invite(p, p.signers[0].id);
  assert.notEqual(first, second);
  assert.equal((await session(first)).status, 404);
  assert.equal((await session(second)).status, 200);
 });

 test('invitación rechazada: otro contrato, firmante ajeno o mal formado, sesión ausente, correo faltante, ya firmado', async () => {
  const p = await pending(), other = await pending();
  assert.equal(await errorCode(await inviteRequest(p, p.signers[0].id, { contractId: other.contractId })), 'PROCESS_NOT_FOUND');
  assert.equal((await inviteRequest(p, 'no-es-uuid')).status, 400);
  assert.equal(await errorCode(await inviteRequest(p, other.signers[0].id)), 'SIGNER_NOT_FOUND');
  assert.equal((await handleSignatureInvitationRequest(new Request('http://x/a', { method: 'GET' }), p.contractId, p.processId, invitationDeps())).status, 405);
  let built = 0;
  const denied = await handleSignatureInvitationRequest(new Request('http://x/a', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), p.contractId, p.processId,
   { authorize: async () => { throw new PdfError(401, 'UNAUTHENTICATED', 'Inicia sesión'); }, service: () => { built++; } });
  assert.equal(denied.status, 401); assert.equal(built, 0, 'sin sesión no se construye el servicio privilegiado');
  const crossSite = await handleSignatureInvitationRequest(new Request('http://x/a', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://otro.example.com' }, body: JSON.stringify({ firmanteId: p.signers[0].id }) }), p.contractId, p.processId, invitationDeps());
  assert.equal(crossSite.status, 403);
  await sql('update personas set correo=null where id=$1', [ids.tenant]);
  try {
   const noMail = await pending();
   const tenant = noMail.signers.find(s => s.rol === 'ARRENDATARIO');
   assert.equal(await errorCode(await inviteRequest(noMail, tenant.id)), 'SIGNER_EMAIL_MISSING');
  } finally { await sql('update personas set correo=$1 where id=$2', [MAILS[ids.tenant], ids.tenant]); }
  const { token, code } = await toCodeStep(p, p.signers[0].id);
  assert.equal((await sign(token, p, code)).status, 200);
  assert.equal(await errorCode(await inviteRequest(p, p.signers[0].id)), 'SIGNER_ALREADY_SIGNED');
 });

 test('sin sitio configurado no se revoca la invitación vigente', async () => {
  const p = await pending();
  const valid = await invite(p, p.signers[0].id);
  const config = () => { throw new PdfError(500, 'SERVER_CONFIGURATION', 'Falta configurar PUBLIC_SITE_URL en el servidor.'); };
  assert.equal(await errorCode(await inviteRequest(p, p.signers[0].id, { site: config })), 'SERVER_CONFIGURATION');
  assert.equal((await session(valid)).status, 200, 'la invitación anterior sigue viva');
 });

 // ---------------------------------------------------------------- sesión y documento
 test('sesión: solo datos para el firmante, sin rutas ni identificadores internos; el consentimiento es el texto de 07', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  const response = await session(token);
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['caracter', 'codigoDisponible', 'consentido', 'consentimientoTexto', 'consentimientoVersion', 'correoParcial', 'expiraAt', 'folio', 'nombreEntidad', 'nombreFirmante', 'otpExpiraAt', 'rol', 'sha256Documento', 'visualizado'].sort());
  const raw = JSON.stringify(body);
  for (const secret of [p.processId, p.contractId, p.documentId, p.originPath, p.signers[0].id, sha(token), token]) assert.ok(!raw.includes(secret), secret);
  assert.match(body.correoParcial, /\*\*\*@example\.com$/);
  assert.equal(body.sha256Documento, p.pdfSha);
  assert.ok(body.consentimientoTexto.includes(p.pdfSha));
  assert.ok(!raw.includes(MAILS[p.signers[0].persona_firmante_id]), 'el correo completo no sale al navegador');
  assert.ok(body.consentimientoTexto.includes(body.correoParcial));
  assert.equal(body.consentimientoVersion, 'CONSENTIMIENTO_FES_V2');
  assert.equal(body.visualizado, false); assert.equal(body.consentido, false);
 });

 test('un token inválido, ausente, vencido o revocado recibe la misma respuesta, y solo se acepta POST', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  const revoked = await invite(p, p.signers[1].id);
  await asRole('service_role', 'select public.revocar_invitacion_firma($1,$2,$3)', [ids.admin, (await invitation(revoked)).id, 'motivo de prueba']);
  const stale = await invite(p, p.signers[0].id);
  await bypass("update firma_privada.invitaciones_firma set emitida_at=now()-interval '2 days',expira_at=now()-interval '1 minute' where token_hash=$1", [hashInvitationToken(stale)]);
  const bodies = [];
  for (const candidate of [undefined, 'corto', 'x'.repeat(43), revoked, stale, token]) {
   const response = await session(candidate);
   assert.equal(response.status, 404, String(candidate));
   const { error } = await response.json();
   bodies.push(`${error.code}|${error.message}`);
  }
  assert.equal(new Set(bodies).size, 1, 'mismo código y mensaje en todos los casos');
  const fresh = await invite(p, p.signers[0].id);
  assert.equal((await session(fresh, { method: 'GET' })).status, 405);
  assert.equal((await session(fresh, { method: 'PUT' })).status, 405);
 });

 test('documento: entrega los bytes exactos del proceso y registra la visualización con su hash, la IP y el navegador', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  const response = await documentOf(token, { headers: { 'x-real-ip': '203.0.113.7', 'user-agent': 'Prueba/1.0' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('x-content-sha256'), p.pdfSha);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.equals(p.bytes));
  const [view] = await events(token, 'DOCUMENTO_VISUALIZADO');
  assert.equal(view.sha256_documento, p.pdfSha); assert.equal(view.ip, '203.0.113.7'); assert.equal(view.user_agent, 'Prueba/1.0');
  assert.equal((await (await session(token)).json()).visualizado, true);
 });

 test('un PDF alterado en Storage no se entrega ni cuenta como visto; un fallo de descarga no deja evento', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  const original = objects.get(p.originPath);
  objects.set(p.originPath, Buffer.from(await realPdf(1)));
  const altered = await documentOf(token);
  assert.equal(altered.status, 409); assert.equal(await errorCode(altered), 'DOCUMENT_MISMATCH');
  objects.delete(p.originPath);
  assert.equal(await errorCode(await documentOf(token)), 'DOCUMENT_UNAVAILABLE');
  assert.equal((await events(token, 'DOCUMENTO_VISUALIZADO')).length, 0);
  objects.set(p.originPath, original);
  assert.equal((await documentOf(token)).status, 200);
 });

 test('una IP de cabecera que no es válida no rompe el registro: queda nula', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  assert.equal((await documentOf(token, { headers: { 'x-real-ip': "1.1.1.1'; drop table x;--" } })).status, 200);
  assert.equal((await events(token, 'DOCUMENTO_VISUALIZADO'))[0].ip, null);
 });

 // ---------------------------------------------------------------- consentimiento
 test('consentimiento: exige haber visto el documento, aceptación expresa, documento y versión correctos; repetirlo no duplica', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  assert.equal(await errorCode(await consent(token, p)), 'SIGNING_STEP_MISSING');
  await documentOf(token);
  assert.equal((await consent(token, p, { acepta: false })).status, 422);
  assert.equal(await errorCode(await consent(token, p, { acepta: 'true' })), 'SIGNING_STEP_MISSING');
  assert.equal(await errorCode(await consent(token, p, { version: 'OTRA' })), 'SIGNING_STEP_MISSING');
  assert.equal(await errorCode(await consent(token, p, { sha256Documento: 'a'.repeat(64) })), 'DOCUMENT_MISMATCH');
  assert.equal((await consent(token, p, { sha256Documento: 'no-es-hash' })).status, 400);
  assert.equal((await consent(token, p)).status, 200);
  assert.equal((await consent(token, p)).status, 200);
  const stored = await sql('select texto from firma_privada.consentimientos_firma c join firma_privada.invitaciones_firma i on i.id=c.invitacion_id where i.token_hash=$1', [hashInvitationToken(token)]);
  assert.equal(stored.length, 1);
  const open = await (await session(token)).json();
  assert.equal(stored[0].texto, open.consentimientoTexto); assert.equal(open.consentido, true);
 });

 // ---------------------------------------------------------------- OTP
 test('código: no sale sin consentimiento; nunca en la respuesta; a la base llega su HMAC', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  codeOutbox.length = 0;
  assert.equal(await errorCode(await requestCode(token)), 'SIGNING_STEP_MISSING');
  assert.equal(codeOutbox.length, 0);
  await documentOf(token); await consent(token, p);
  rpcCalls.length = 0;
  const response = await requestCode(token);
  assert.equal(response.status, 200);
  const raw = await response.text();
  const code = codeFrom(codeOutbox[0]);
  assert.match(code, /^\d{6}$/);
  assert.ok(!raw.includes(code));
  assert.ok(!JSON.stringify(codeOutbox[0]).includes(MAILS[p.signers[0].persona_firmante_id]), 'solo el correo enmascarado llega al canal');
  const body = JSON.parse(raw);
  assert.deepEqual(Object.keys(body).sort(), ['codigosRestantes', 'expiraAt']);
  assert.equal(body.codigosRestantes, 4);
  const inv = await invitation(token);
  const [otp] = await otps(token);
  assert.equal(otp.otp_hmac, otpHmac(SECRET, inv.id, code));
  assert.ok(!JSON.stringify(rpcCalls).includes(code), 'las RPC nunca reciben el código en claro');
  assert.ok(!JSON.stringify(rpcCalls).includes(token), 'las RPC nunca reciben el token en claro');
  assert.equal((await (await session(token)).json()).otpExpiraAt !== null, true);
 });

 test('reenvío: espera 60 s, invalida el código anterior y se detiene a los 5 códigos', async () => {
  const p = await pending();
  const { token, code: first } = await toCodeStep(p, p.signers[0].id);
  const soon = await requestCode(token);
  assert.equal(soon.status, 429); assert.equal(await errorCode(soon), 'OTP_TOO_SOON');
  await allowResend(token);
  codeOutbox.length = 0;
  assert.equal((await requestCode(token)).status, 200);
  const second = codeFrom(codeOutbox[0]);
  if (first !== second) {
   const stale = await (await sign(token, p, first)).json();
   assert.equal(stale.resultado, 'OTP_INCORRECTO', 'el código anterior ya no sirve');
  }
  for (let n = 0; n < 3; n++) { await allowResend(token); assert.equal((await requestCode(token)).status, 200); }
  await allowResend(token);
  codeOutbox.length = 0;
  const limit = await requestCode(token);
  assert.equal(limit.status, 429); assert.equal(await errorCode(limit), 'OTP_LIMIT_REACHED');
  assert.equal(codeOutbox.length, 0);
 });

 test('código: sin secreto o sin canal de entrega no se emite ninguno, y la sesión lo indica', async () => {
  const p = await pending();
  const token = await invite(p, p.signers[0].id);
  await documentOf(token); await consent(token, p);
  const c = client();
  const broken = over => ({ deps: { service: () => createSignerFlowService({ repository: signerRepository(c), storage, signing: { submit() { throw new Error('no debe llamarse'); } }, otpSecret: () => SECRET, otpDelivery, ...over }) } });
  const config = () => { throw new PdfError(500, 'SERVER_CONFIGURATION', 'Falta configuración'); };
  assert.equal(await errorCode(await requestCode(token, broken({ otpSecret: config }))), 'SERVER_CONFIGURATION');
  const unavailable = await requestCode(token, broken({ otpDelivery: () => null }));
  assert.equal(unavailable.status, 503); assert.equal(await errorCode(unavailable), 'OTP_CHANNEL_UNAVAILABLE');
  assert.equal((await otps(token)).length, 0, 'no se gastó ningún código');
  assert.equal((await (await session(token)).json()).codigoDisponible, true);
  assert.equal((await (await signer.handleSignerSessionRequest(new Request('http://x/a', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }), broken({ otpDelivery: () => null }).deps)).json()).codigoDisponible, false);
 });

 // ---------------------------------------------------------------- firma
 test('código incorrecto: resta intentos y a los 5 lo agota; un código vencido se rechaza; el mal formado no gasta intentos', async () => {
  const p = await pending();
  const { token, code } = await toCodeStep(p, p.signers[0].id);
  for (const malformed of ['12345', 'abcdef', '1234567', 123456]) {
   const response = await sign(token, p, malformed);
   assert.equal(response.status, 422); assert.equal(await errorCode(response), 'OTP_MALFORMED');
  }
  assert.equal((await otps(token))[0].intentos, 0);
  for (let remaining = 4; remaining > 0; remaining--) {
   const response = await sign(token, p, wrongCode(code));
   assert.equal(response.status, 200);
   assert.deepEqual(await response.json(), { resultado: 'OTP_INCORRECTO', intentosRestantes: remaining });
  }
  assert.deepEqual(await (await sign(token, p, wrongCode(code))).json(), { resultado: 'OTP_AGOTADO', intentosRestantes: 0 });
  assert.equal((await (await sign(token, p, code)).json()).resultado, 'OTP_INEXISTENTE', 'el código correcto ya no sirve tras agotarlo');
  await allowResend(token);
  codeOutbox.length = 0;
  await requestCode(token);
  const fresh = codeFrom(codeOutbox[0]);
  await expireOtp(token);
  assert.deepEqual(await (await sign(token, p, fresh)).json(), { resultado: 'OTP_VENCIDO', intentosRestantes: 0 });
  assert.equal((await sql("select count(*)::int n from firma_privada.firmas_electronicas where proceso_firma_id=$1", [p.processId]))[0].n, 0);
 });

 test('dibujo vacío, sin confirmar u otro documento: se rechaza sin gastar intentos y el código sigue sirviendo', async () => {
  const p = await pending();
  const { token, code } = await toCodeStep(p, p.signers[0].id);
  const empty = await sign(token, p, code, { firmaPng: blankBase64() });
  assert.equal(empty.status, 422); assert.equal(await errorCode(empty), 'DRAWN_SIGNATURE_EMPTY');
  assert.equal(await errorCode(await sign(token, p, code, { firmaPng: 'no es una imagen' })), 'DRAWN_SIGNATURE_INVALID');
  assert.equal(await errorCode(await sign(token, p, code, { firmaPng: undefined })), 'DRAWN_SIGNATURE_INVALID');
  assert.equal(await errorCode(await sign(token, p, code, { confirmacion: false })), 'SIGNATURE_NOT_CONFIRMED');
  assert.equal(await errorCode(await sign(token, p, code, { confirmacion: 'true' })), 'SIGNATURE_NOT_CONFIRMED');
  assert.equal(await errorCode(await sign(token, p, code, { sha256Documento: 'a'.repeat(64) })), 'DOCUMENT_MISMATCH');
  assert.equal((await sign(token, p, code, { sha256Documento: 'no-es-hash' })).status, 400);
  assert.equal((await otps(token))[0].intentos, 0);
  assert.equal((await (await sign(token, p, code)).json()).resultado, 'FIRMADO');
 });

 test('firma correcta: guarda imagen y evidencia, el resultado no expone internos y el enlace ya no sirve', async () => {
  const p = await pending();
  const { token, code } = await toCodeStep(p, p.signers[0].id);
  const png = scribbleBase64();
  const response = await sign(token, p, code, { firmaPng: png }, { headers: { 'x-real-ip': '198.51.100.9', 'user-agent': 'Movil/2.0' } });
  assert.equal(response.status, 200);
  const raw = await response.text();
  const body = JSON.parse(raw);
  assert.deepEqual(Object.keys(body).sort(), ['finalizacion', 'firmadoAt', 'firmantesPendientes', 'resultado', 'sha256Documento', 'sha256Evidencia', 'sha256Firma'].sort());
  assert.equal(body.finalizacion, 'NO_REQUERIDA'); assert.equal(body.firmantesPendientes, 1);
  assert.equal(body.sha256Documento, p.pdfSha);
  const [stored] = await sql('select * from firma_privada.firmas_electronicas where proceso_firma_id=$1', [p.processId]);
  assert.equal(stored.ip, '198.51.100.9'); assert.equal(stored.user_agent, 'Movil/2.0'); assert.equal(stored.sha256_firma, sha(Buffer.from(png, 'base64')));
  assert.equal(body.sha256Firma, stored.sha256_firma); assert.equal(body.sha256Evidencia, stored.sha256_evidencia);
  assert.ok(Buffer.from(stored.firma_png).equals(Buffer.from(png, 'base64')));
  assert.ok(!raw.includes(stored.id)); assert.ok(!raw.includes(stored.correo));
  for (const again of [await session(token), await documentOf(token), await requestCode(token), await sign(token, p, code)]) assert.equal(again.status, 404);
 });

 test('todas las firmas por HTTP: la última genera y registra el PDF final, y el contrato queda firmado', async () => {
  const p = await pending({ guarantor: true });
  assert.equal(p.signers.length, 3);
  let last;
  for (const s of p.signers) {
   const { token, code } = await toCodeStep(p, s.id);
   last = await (await sign(token, p, code)).json();
  }
  assert.equal(last.finalizacion, 'COMPLETADA'); assert.equal(last.firmantesPendientes, 0);
  assert.equal((await sql('select estado::text e from contratos where id=$1', [p.contractId]))[0].e, 'FIRMADO');
  const process = (await sql('select * from procesos_firma where id=$1', [p.processId]))[0];
  const final = objects.get(`${p.contractId}/firmas/${p.processId}/firmado.pdf`);
  assert.equal(process.sha256_documento_firmado, sha(final));
  assert.equal((await PDFDocument.load(final)).getPageCount(), 3);
 });

 test('PDF final real con cada valor del catálogo: etiqueta correcta en la constancia y ningún código visible', async () => {
  const labels = { REPRESENTANTE_LEGAL: 'Representante legal', APODERADO_LEGAL: 'Apoderado legal', ADMINISTRADOR: 'Administrador', OTRO: null };
  const [rep] = await sql('select id,caracter from representantes_persona_moral where persona_moral_id=$1 and es_principal', [ids.company]);
  try {
   for (const [code, label] of Object.entries(labels)) {
    await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, code]);
    const p = await pending();
    let last;
    for (const s of p.signers) { const { token, code: otp } = await toCodeStep(p, s.id); last = await (await sign(token, p, otp)).json(); }
    assert.equal(last.finalizacion, 'COMPLETADA', code);
    const final = objects.get(`${p.contractId}/firmas/${p.processId}/firmado.pdf`);
    const pdf = await getDocument({ data: new Uint8Array(final), verbosity: 0, useSystemFonts: false, disableFontFace: true }).promise;
    const text = (await (await pdf.getPage(pdf.numPages)).getTextContent()).items.map(item => item.str).join(' ');
    assert.match(text, /Constancia de firmas electrónicas/);
    for (const internal of Object.keys(labels)) assert.ok(!text.includes(internal), `${code}: aparece ${internal}`);
    assert.doesNotMatch(text, /[A-Z]+_[A-Z]+/, code);
    assert.ok(text.includes('Carácter: Por derecho propio'), 'el arrendatario conserva su etiqueta');
    if (label) assert.ok(text.includes(`Carácter: ${label}`), code);
    else { assert.equal(text.split('Carácter:').length - 1, 1, 'OTRO no genera línea; solo queda la del arrendatario'); assert.doesNotMatch(text, /Carácter:\s*(Otro|OTRO)/); }
    await pdf.destroy();
   }
  } finally { await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, rep.caracter]); }
 });

 test('si el cierre falla, la firma queda registrada y el resultado lo dice', async () => {
  const p = await pending();
  const first = await toCodeStep(p, p.signers[0].id);
  assert.equal((await (await sign(first.token, p, first.code)).json()).resultado, 'FIRMADO');
  const second = await toCodeStep(p, p.signers[1].id);
  const original = objects.get(p.originPath);
  objects.set(p.originPath, Buffer.from(await realPdf(1)));
  const body = await (await sign(second.token, p, second.code)).json();
  objects.set(p.originPath, original);
  assert.equal(body.resultado, 'FIRMADO'); assert.equal(body.finalizacion, 'PENDIENTE');
  assert.equal((await sql('select estado from procesos_firma where id=$1', [p.processId]))[0].estado, 'PENDIENTE');
 });

 test('los errores no filtran detalles internos y los registros no llevan token, código ni imagen', async () => {
  const p = await pending();
  const { token, code } = await toCodeStep(p, p.signers[0].id);
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(JSON.stringify(args));
  try {
   await sign(token, p, code, { firmaPng: blankBase64() });
   const crash = await requestCode(token, { deps: { service: () => { throw new Error('secreto interno de la base'); } } });
   assert.equal(crash.status, 500);
   const body = await crash.text();
   assert.ok(!body.includes('secreto interno')); assert.ok(JSON.parse(body).requestId);
  } finally { console.error = originalError; }
  assert.ok(logged.length >= 2);
  for (const line of logged) { assert.ok(!line.includes(token)); assert.ok(!line.includes(code)); assert.ok(!line.includes(sha(token))); }
 });

 // ---------------------------------------------------------------- navegador real
 describe('página real en Chromium', () => {
  const browserReady = existsSync(chromium.executablePath());
  const skip = browserReady ? false : 'Chromium no está instalado';
  let browser, server, base;
  const seen = [];
  const handlers = { sesion: signer.handleSignerSessionRequest, documento: signer.handleSignerDocumentRequest, consentimiento: signer.handleSignerConsentRequest, codigo: signer.handleSignerCodeRequest, firmar: signer.handleSignerSignRequest };

  // Vite y Tailwind, como en producción: el diseño real y el worker de pdf.js con su ruta real.
  async function bundle() {
   const root = fileURLToPath(new URL('../', import.meta.url));
   const entry = 'virtual:signing-entry';
   const result = await viteBuild({
    configFile: false, root, logLevel: 'silent', mode: 'production', publicDir: false, resolve: { alias: { '@': `${root}src` } },
    plugins: [tailwindcss(), { name: 'signing-entry', resolveId: id => (id === entry ? `\0${entry}` : null), load: id => (id === `\0${entry}` ? `import {createElement} from 'react';import {createRoot} from 'react-dom/client';import '/src/styles/global.css';import SigningPage from '/src/modules/admin/arrendamiento/contratos/firmas/publica/SigningPage.tsx';createRoot(document.getElementById('root')).render(createElement(SigningPage));` : null) }],
    build: { write: false, minify: false, assetsInlineLimit: 0, rollupOptions: { input: entry } },
   });
   return Object.fromEntries(result.output.map(file => [`/${file.fileName}`, { source: file.code ?? file.source, entry: file.isEntry }]));
  }

  before(async () => {
   if (!browserReady) return;
   const assets = await bundle();
   const names = Object.keys(assets);
   assert.ok(names.some(name => /pdf\.worker/.test(name)), 'Vite emite el worker de pdf.js');
   for (const name of names.filter(file => /\.m?js$/.test(file) && !/pdf\.worker/.test(file))) assert.ok(!/SERVICE_ROLE|FIRMA_OTP_SECRET|RESEND_API_KEY/.test(assets[name].source), `${name} no contiene nombres de secretos`);
   const script = names.find(name => assets[name].entry), style = names.find(name => name.endsWith('.css'));
   const page = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${style}"></head><body class="min-h-screen bg-gray-50 text-gray-900"><div id="root"></div><script type="module" src="${script}"></script></body></html>`;
   server = createServer(async (req, res) => {
    seen.push({ url: req.url, referer: req.headers.referer ?? '' });
    const send = (status, type, body) => { res.writeHead(status, { 'content-type': type }); res.end(body); };
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/firmar') return send(200, 'text/html', page);
    if (assets[url.pathname]) return send(200, url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', assets[url.pathname].source);
    const action = url.pathname.match(/^\/api\/firma\/(\w+)$/)?.[1];
    if (!handlers[action]) return send(404, 'text/plain', 'no');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([, v]) => typeof v === 'string'));
    const response = await handlers[action](new Request(`http://x${req.url}`, { method: req.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }), signerDeps);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
   });
   await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
   base = `http://127.0.0.1:${server.address().port}`;
   browser = await chromium.launch({ executablePath: chromium.executablePath(), headless: true });
  });
  after(async () => { await browser?.close(); server?.close(); });

  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const nonBlankPixels = canvas => canvas.evaluate(el => { const { data } = el.getContext('2d').getImageData(0, 0, el.width, el.height); let n = 0; for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0 && data[i] < 128) n++; return n; });

  // Trazo táctil real por el protocolo del navegador.
  async function touchDraw(page, canvas, cdp, stroke) {
   const box = await canvas.boundingBox();
   const at = ([x, y]) => [{ x: box.x + box.width * x, y: box.y + box.height * y }];
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(stroke[0]) });
   for (const point of stroke.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(point) });
   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  const WAVE = Array.from({ length: 40 }, (_, i) => [0.1 + i * 0.02, 0.5 + Math.sin(i / 3) * 0.3]);

  let lastStepOne = '';
  async function reviewAndConsent(page, p, token) {
   await page.goto(`${base}/firmar#t=${token}`);
   const pages = page.locator('[data-testid=pdf-pages] canvas');
   await pages.nth(1).waitFor();
   assert.equal(await pages.count(), 2, 'muestra cada página del PDF');
   await page.getByText('Preparando el documento', { exact: false }).waitFor({ state: 'detached' });
   assert.ok(await nonBlankPixels(pages.first()) > 100, 'el PDF se dibujó');
   // La casilla exige llegar al final del PDF: a medio camino sigue desactivada.
   const box = page.getByTestId('pdf-pages'), accept = page.locator('input[name=acepta]');
   const prompt = page.getByText('Desplázate hasta el final del documento', { exact: false });
   await prompt.waitFor();
   assert.ok(await box.evaluate(el => el.scrollHeight > el.clientHeight + 50), 'el documento tiene desplazamiento');
   assert.equal(await accept.isDisabled(), true);
   await box.evaluate(el => { el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; });
   await page.waitForTimeout(150);
   assert.equal(await accept.isDisabled(), true, 'a la mitad no se habilita');
   await box.evaluate(el => { el.scrollTop = el.scrollHeight; });
   await prompt.waitFor({ state: 'detached' });
   assert.equal(await accept.isDisabled(), false, 'al final se habilita');
   assert.equal(await button(page, 'Aceptar y continuar').isDisabled(), true, 'sin marcar la casilla no avanza');
   lastStepOne = await page.locator('main').innerText();
   const consentText = page.getByTestId('consent-text');
   const shown = await consentText.innerText();
   assert.equal(shown, await consentText.textContent(), 'se muestra sin alterar párrafos ni espacios');
   assert.ok(!/[A-Z]+_[A-Z]+/.test(shown), 'sin valores técnicos en pantalla');
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'el texto, con su huella larga, no desborda la pantalla');
   await accept.check();
   await button(page, 'Aceptar y continuar').click();
   await page.getByText('Paso 2 de 3', { exact: false }).waitFor();
   return shown;
  }

  async function codeAndSign(page, code, wrong) {
   await button(page, 'Continuar').click();
   codeOutbox.length = 0;
   await button(page, 'Generar código').click();
   await page.locator('input[name=codigo]').waitFor();
   const sent = codeFrom(codeOutbox[0]);
   const sign = button(page, 'Firmar documento');
   if (wrong) {
    await page.locator('input[name=codigo]').fill(wrongCode(sent));
    await page.locator('input[name=confirmacion]').check();
    await sign.click();
    await page.getByRole('alert').filter({ hasText: 'Te quedan 4 intentos' }).waitFor();
   } else await page.locator('input[name=confirmacion]').check();
   assert.equal(await sign.isDisabled(), true, 'sin un código de 6 dígitos no se envía');
   await page.locator('input[name=codigo]').fill(sent);
   await sign.click();
   await page.getByRole('heading', { name: 'Tu firma quedó registrada' }).waitFor();
   return sent;
  }

  test('celular con dedo y computadora con ratón: firman de punta a punta y la imagen guardada pasa la validación real', { skip, timeout: 120_000 }, async () => {
   const p = await pending();
   const landlord = p.signers.find(s => s.rol === 'ARRENDADOR'), tenant = p.signers.find(s => s.rol === 'ARRENDATARIO');

   // Celular: pantalla táctil, trazo con el dedo.
   const phone = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
   const mobile = await phone.newPage();
   const failures = [];
   mobile.on('pageerror', error => failures.push(error.message));
   seen.length = 0;
   const token = await invite(p, landlord.id);
   const shown = await reviewAndConsent(mobile, p, token);
   assert.ok(!shown.includes(MAILS[landlord.persona_firmante_id]), 'el correo completo no se muestra');
   const [stored] = await sql('select c.texto,c.version from firma_privada.consentimientos_firma c join firma_privada.invitaciones_firma i on i.id=c.invitacion_id where i.token_hash=$1', [hashInvitationToken(token)]);
   assert.equal(stored.texto, shown, 'lo guardado es exactamente lo mostrado en pantalla');
   assert.equal(stored.version, 'CONSENTIMIENTO_FES_V2');
   const canvas = mobile.getByTestId('signature-canvas');
   const cdp = await phone.newCDPSession(mobile);
   // Un toque no alcanza: el botón sigue desactivado.
   await touchDraw(mobile, canvas, cdp, [[0.5, 0.5], [0.501, 0.5]]);
   assert.equal(await button(mobile, 'Continuar').isDisabled(), true);
   await button(mobile, 'Borrar y volver a dibujar').click();
   const scrollBefore = await mobile.evaluate(() => window.scrollY);
   await touchDraw(mobile, canvas, cdp, WAVE);
   assert.equal(await mobile.evaluate(() => window.scrollY), scrollBefore, 'dibujar no desplaza la página');
   assert.ok(await nonBlankPixels(canvas) > 100, 'el trazo se ve en el lienzo');
   // Girar el celular conserva el trazo.
   await mobile.setViewportSize({ width: 780, height: 390 });
   await mobile.waitForFunction(() => document.querySelector('[data-testid=signature-canvas]').width > 1000);
   await mobile.waitForFunction(() => { const c = document.querySelector('[data-testid=signature-canvas]'); const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height); return data.some((v, i) => i % 4 === 3 && v > 0); });
   await mobile.setViewportSize({ width: 390, height: 780 });
   await codeAndSign(mobile, null, true);
   assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'el resultado no desborda la pantalla');
   assert.match(await mobile.locator('main').innerText(), /Falta 1 firma de otras partes/);
   assert.deepEqual(failures, []);
   await phone.close();
   for (const entry of seen) { assert.ok(!entry.url.includes(token), 'el token no viaja en la URL'); assert.ok(!entry.referer.includes(token), 'ni en el Referer'); }
   const [first] = await sql('select firma_png,sha256_firma from firma_privada.firmas_electronicas where firmante_id=$1', [landlord.id]);
   const png = new Uint8Array(first.firma_png);
   assert.doesNotThrow(() => validateDrawnSignature(png));
   assert.equal(first.sha256_firma, sha(png));
   const signed = (await sql("select f.sha256_evidencia,firma_privada.sha256_texto(concat_ws('|','EVIDENCIA_FES_V1',f.id,f.proceso_firma_id,f.firmante_id,f.invitacion_id,f.consentimiento_id,$2::text,f.otp_id,f.persona_firmante_id,f.correo,f.sha256_documento,f.sha256_firma,firma_privada.utc_texto(f.firmado_at))) h,f.correo from firma_privada.firmas_electronicas f where f.firmante_id=$1", [landlord.id, sha(Buffer.from(shown, 'utf8'))]))[0];
   assert.equal(signed.sha256_evidencia, signed.h, 'la evidencia firmada incluye el hash del texto que se vio en pantalla');
   assert.equal(signed.correo, MAILS[landlord.persona_firmante_id], 'el correo completo sigue en la evidencia');
   const parsed = pngjs.PNG.sync.read(Buffer.from(png));
   assert.deepEqual([parsed.width, parsed.height], [1000, 400], 'mismo tamaño aunque se dibuje en un celular');

   // Reabrir un enlace ya usado no revela datos.
   const reopened = await browser.newContext();
   const again = await reopened.newPage();
   await again.goto(`${base}/firmar#t=${token}`);
   await again.getByRole('heading', { name: 'Este enlace ya no está disponible' }).waitFor();
   await reopened.close();

   // Computadora: última firma con ratón, cierra el proceso.
   const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
   const pc = await desktop.newPage();
   await reviewAndConsent(pc, p, await invite(p, tenant.id));
   const box = await pc.getByTestId('signature-canvas').boundingBox();
   await pc.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
   await pc.mouse.down();
   for (const [x, y] of WAVE) await pc.mouse.move(box.x + box.width * x, box.y + box.height * y);
   await pc.mouse.up();
   await codeAndSign(pc, null, false);
   assert.match(await pc.locator('main').innerText(), /Todas las partes firmaron y el contrato quedó firmado/);
   await desktop.close();
   assert.equal((await sql('select estado::text e from contratos where id=$1', [p.contractId]))[0].e, 'FIRMADO');
   assert.ok(objects.has(`${p.contractId}/firmas/${p.processId}/firmado.pdf`));
  });

  test('cada valor del catálogo en pantalla: sin códigos, y lo mostrado es exactamente lo almacenado', { skip, timeout: 120_000 }, async () => {
   const expected = { REPRESENTANTE_LEGAL: 'en mi carácter de representante legal de', APODERADO_LEGAL: 'en mi carácter de apoderado legal de', ADMINISTRADOR: 'en mi carácter de administrador de', OTRO: 'en representación de' };
   const [rep] = await sql('select id,caracter from representantes_persona_moral where persona_moral_id=$1 and es_principal', [ids.company]);
   try {
    for (const [code, phrase] of Object.entries(expected)) {
     await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, code]);
     const p = await pending();
     const landlord = p.signers.find(s => s.rol === 'ARRENDADOR');
     const token = await invite(p, landlord.id);
     const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
     const page = await context.newPage();
     const shown = await reviewAndConsent(page, p, token);
     await context.close();
     assert.ok(shown.includes(`, ${phrase} `), code);
     const heading = { REPRESENTANTE_LEGAL: '(Arrendador, Representante legal)', APODERADO_LEGAL: '(Arrendador, Apoderado legal)', ADMINISTRADOR: '(Arrendador, Administrador)', OTRO: '(Arrendador)' }[code];
     assert.ok(lastStepOne.includes(heading), `${code}: encabezado ${heading}`);
     for (const internal of Object.keys(expected)) assert.ok(!lastStepOne.includes(internal), `${code}: aparece ${internal}`);
     assert.doesNotMatch(lastStepOne, /[A-Z]+_[A-Z]+|, \)|\(, /, code);
     assert.ok(!shown.includes(code), code); assert.ok(!shown.includes(MAILS[landlord.persona_firmante_id]), code); assert.match(shown, /\*\*\*@example\.com/);
     const [stored] = await sql('select c.texto,c.version,i.correo from firma_privada.consentimientos_firma c join firma_privada.invitaciones_firma i on i.id=c.invitacion_id where i.token_hash=$1', [hashInvitationToken(token)]);
     assert.equal(stored.texto, shown, `${code}: lo almacenado es lo mostrado`);
     assert.equal(stored.version, 'CONSENTIMIENTO_FES_V2');
     assert.equal(stored.correo, MAILS[landlord.persona_firmante_id]);
    }
   } finally { await bypass('update representantes_persona_moral set caracter=$2 where id=$1', [rep.id, rep.caracter]); }
  });

  test('sin token en el enlace, la página no llama a la API', { skip, timeout: 30_000 }, async () => {
   const context = await browser.newContext();
   const page = await context.newPage();
   seen.length = 0;
   await page.goto(`${base}/firmar`);
   await page.getByRole('heading', { name: 'Este enlace ya no está disponible' }).waitFor();
   assert.equal(seen.filter(entry => entry.url.startsWith('/api/')).length, 0);
   await context.close();
  });

  test('navegador que no puede mostrar el PDF: mensaje claro, y descargarlo no permite aceptar', { skip, timeout: 60_000 }, async () => {
   const p = await pending();
   const token = await invite(p, p.signers[0].id);
   const context = await browser.newContext({ acceptDownloads: true });
   const page = await context.newPage();
   await page.route('**/*pdf.worker*', route => route.abort());
   await page.goto(`${base}/firmar#t=${token}`);
   await page.getByRole('alert').filter({ hasText: 'navegador compatible' }).waitFor({ timeout: 45_000 });
   const download = page.waitForEvent('download');
   await page.getByRole('link', { name: 'Descargar el PDF' }).click();
   await download;
   assert.equal(await page.locator('input[name=acepta]').isDisabled(), true);
   assert.equal(await button(page, 'Aceptar y continuar').isDisabled(), true);
   await context.close();
  });

  test('quien ya consintió regresa: sin desplazarse ni aceptar otra vez, y sin duplicar el consentimiento', { skip, timeout: 60_000 }, async () => {
   const p = await pending();
   const token = await invite(p, p.signers[0].id);
   await documentOf(token); await consent(token, p);
   const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
   const page = await context.newPage();
   await page.goto(`${base}/firmar#t=${token}`);
   await page.getByText('Ya aceptaste este texto', { exact: false }).waitFor();
   await page.locator('[data-testid=pdf-pages] canvas').nth(1).waitFor();
   await page.getByText('Preparando el documento', { exact: false }).waitFor({ state: 'detached' });
   assert.equal(await page.locator('input[name=acepta]').count(), 0);
   assert.ok(await page.getByTestId('pdf-pages').evaluate(el => el.scrollTop === 0 && el.scrollHeight > el.clientHeight));
   await button(page, 'Continuar').click();
   await page.getByText('Paso 2 de 3', { exact: false }).waitFor();
   assert.equal((await sql('select count(*)::int n from firma_privada.consentimientos_firma c join firma_privada.invitaciones_firma i on i.id=c.invitacion_id where i.token_hash=$1', [hashInvitationToken(token)]))[0].n, 1);
   await context.close();
  });

  test('documento que cabe en pantalla: se habilita al terminar de dibujarlo, sin desplazarse', { skip, timeout: 60_000 }, async () => {
   const p = await pending();
   const token = await invite(p, p.signers[0].id);
   const context = await browser.newContext({ viewport: { width: 500, height: 3000 } });
   const page = await context.newPage();
   await page.goto(`${base}/firmar#t=${token}`);
   await page.locator('[data-testid=pdf-pages] canvas').nth(1).waitFor();
   await page.getByText('Preparando el documento', { exact: false }).waitFor({ state: 'detached' });
   assert.ok(await page.getByTestId('pdf-pages').evaluate(el => el.scrollHeight <= el.clientHeight + 8), 'cabe sin desplazarse');
   assert.equal(await page.locator('input[name=acepta]').isDisabled(), false);
   await context.close();
  });

  test('un PDF alterado en el camino se detecta también en el navegador y no permite continuar', { skip, timeout: 60_000 }, async () => {
   const p = await pending();
   const token = await invite(p, p.signers[0].id);
   const context = await browser.newContext();
   const page = await context.newPage();
   await page.route('**/api/firma/documento', async route => { const response = await route.fetch(); await route.fulfill({ response, body: Buffer.from(await realPdf(1)) }); });
   await page.goto(`${base}/firmar#t=${token}`);
   await page.getByRole('alert').filter({ hasText: 'no coincide' }).waitFor();
   assert.equal(await page.locator('[data-testid=pdf-pages] canvas').count(), 0);
   assert.equal(await page.locator('input[name=acepta]').isDisabled(), true);
   await context.close();
  });
 });
});

// ---------------------------------------------------------------- canal de códigos
describe('canal de códigos sin proveedor de correo', () => {
 test('la consola exige compilación de desarrollo y activación expresa', () => {
  assert.equal(selectOtpDelivery({ dev: false, enabled: true }), null, 'en producción la variable no lo activa');
  assert.equal(selectOtpDelivery({ dev: false, enabled: false }), null);
  assert.equal(selectOtpDelivery({ dev: true, enabled: false }), null, 'en desarrollo hay que pedirlo');
  assert.ok(selectOtpDelivery({ dev: true, enabled: true }));
 });

 test('la consola imprime el código y solo datos enmascarados', () => {
  const lines = [];
  consoleOtpDelivery(line => lines.push(line)).deliver({ folio: 'CTR-1', correoParcial: 'an***@example.com', code: '012345', expiresAt: '2026-11-05T18:00:00Z' });
  assert.match(lines[0], /^\[firma-otp-dev\] Código 012345 /); assert.match(lines[0], /an\*\*\*@example\.com/);
 });

 test('no queda integración de correo y el interruptor depende de la compilación', () => {
  const server = '../src/modules/admin/arrendamiento/contratos/firmas/server/';
  for (const file of ['dependencies.ts', 'invitationService.ts', 'otpDelivery.ts', 'signerFlowService.ts']) assert.doesNotMatch(read(server + file), /api\.resend\.com|RESEND_API_KEY|FIRMA_EMAIL_FROM/, file);
  assert.match(read(server + 'dependencies.ts'), /selectOtpDelivery\(\{ dev: import\.meta\.env\.DEV,/);
 });
});

// ---------------------------------------------------------------- límites de la interfaz
describe('separación entre navegador y servidor', () => {
 const publica = '../src/modules/admin/arrendamiento/contratos/firmas/publica/';
 test('la página pública no importa código de servidor ni credenciales, y sus cabeceras protegen el enlace', () => {
  for (const file of ['SigningPage.tsx', 'SignaturePad.tsx', 'PdfViewer.tsx', 'pdfRenderer.ts', 'signer.client.ts']) {
   assert.doesNotMatch(read(publica + file), /SERVICE_ROLE|service_role|serviceClient|\/server\/|supabase|FIRMA_OTP_SECRET|RESEND_API_KEY|https?:\/\//, file);
  }
  const page = read('../src/pages/firmar.astro');
  assert.doesNotMatch(page, /Layout|<script[^>]+src=|https?:\/\/(?!www\.w3)/, 'sin plantilla general ni scripts de terceros');
  for (const header of ['"Cache-Control", "no-store"', '"Referrer-Policy", "no-referrer"', '"X-Robots-Tag", "noindex"', '"X-Frame-Options", "DENY"']) assert.ok(page.includes(header), header);
 });

 test('todas las rutas del firmante existen y usan un manejador real', () => {
  for (const [route, handler] of Object.entries({ sesion: 'handleSignerSessionRequest', documento: 'handleSignerDocumentRequest', consentimiento: 'handleSignerConsentRequest', codigo: 'handleSignerCodeRequest', firmar: 'handleSignerSignRequest' })) {
   const source = read(`../src/pages/api/firma/${route}.ts`);
   assert.ok(source.includes(handler) && source.includes('signerRequestDependencies()') && source.includes('prerender = false'), route);
  }
  assert.ok(read('../src/pages/api/admin/arrendamiento/contratos/[contratoId]/firmas/[procesoId]/invitaciones.ts').includes('invitationRequestDependencies(cookies)'));
 });

 test('el secreto del OTP debe existir y tener largo suficiente, y el enlace no sale de la cabecera Host', () => {
  const dependencies = read('../src/modules/admin/arrendamiento/contratos/firmas/server/dependencies.ts');
  assert.match(dependencies, /secret\.length < 32/);
  assert.match(dependencies, /PUBLIC_SITE_URL/);
  assert.doesNotMatch(read('../src/modules/admin/arrendamiento/contratos/firmas/server/invitationService.ts'), /request|headers|host/i);
 });
});
