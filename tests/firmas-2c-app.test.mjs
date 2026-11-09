import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
// Flujo de inicio de firma de la app. Fakes y PostgreSQL local en memoria (PGlite); jamás Supabase.
registerHooks({ resolve(specifier, context, next) {
 if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
 if (context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !/\.tsx?$/.test(specifier)) return next(`${specifier}.ts`, context);
 return next(specifier, context);
} });
const mod = '../src/modules/admin/arrendamiento/contratos/';
const { createSignatureService } = await import(`${mod}firmas/server/signatureService.ts`);
const { handleSignatureStartRequest, handleSignatureCancelRequest } = await import(`${mod}firmas/server/request.ts`);
const { createCancellationService } = await import(`${mod}firmas/server/cancellationService.ts`);
const { contextSourceFromSources, identitiesFromSources } = await import(`${mod}firmas/server/sources.ts`);
const { canStartSignature } = await import(`${mod}firmas/model.ts`);
const { PdfError } = await import(`${mod}documentos/server/errors.ts`);
const { buildContractTemplateContext } = await import(`${mod}plantillas/services/context.service.ts`);
const { renderContractTemplate } = await import(`${mod}plantillas/renderer.ts`);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');

const C = '11111111-1111-4111-8111-111111111111', D = '22222222-2222-4222-8222-222222222222', M = '33333333-3333-4333-8333-333333333333';
const R = '44444444-4444-4444-8444-444444444444', REP = '55555555-5555-4555-8555-555555555555', T = '66666666-6666-4666-8666-666666666666';
const G = '77777777-7777-4777-8777-777777777777', V = '88888888-8888-4888-8888-888888888888', ACTOR = '99999999-9999-4999-8999-999999999999';
const person = (id, nombre, rfc, curp) => ({ id, nombre, apellido_paterno: 'Pérez', apellido_materno: null, rfc, curp, domicilio_origen: null, telefono: null, correo: null });
const company = { id: M, razon_social: 'Empresa  Arrendadora SA de CV', nombre_comercial: null, rfc: 'EAR010101EEE', domicilio: null, ciudad: null, estado: null, codigo_postal: null, telefono: null, correo: null, estatus: 'ACTIVA' };
const contractRow = { id: C, estado: 'BORRADOR', arrendador_persona_moral_id: M, folio: 'CTR-2026-000001', fecha_inicio: '2026-11-01', fecha_fin: '2027-10-31', renta: 12000, deposito: 12000,
 dia_pago: 1, fecha_firma: null, lugar_firma: 'Monterrey', costo_lavanderia: 350.5, domicilio_arrendador: 'Calle 1', domicilio_arrendatario: 'Calle 2', domicilio_fiador: 'Calle 3' };
const unit = { nombre: 'Departamento 101', numero: '101', tipo: 'DEPARTAMENTO', piso: '1', ubicacion: 'Norte' }, building = { nombre: 'Torre', direccion: 'Av. 1', ciudad: 'Monterrey', estado: 'Nuevo León', codigo_postal: '64000' };
const people = { rep: person(REP, 'Manuel', 'PERM800101AAA', 'PERM800101HNLRZN01'), tenant: person(T, 'Ana', 'PEAA900101BBB', 'PEAA900101MNLRNN02'), guarantor: person(G, 'Luis', 'PELU700101CCC', null) };
// Forma de firma_fuentes_para_verificar: filas completas, partes ordenadas por id.
function fuentes() {
 return structuredClone({ contrato: { ...contractRow, solicitud_id: 'abababab-abab-4bab-8bab-abababababab', unidad_id: 1, created_at: '2026-10-01T00:00:00+00:00', updated_at: '2026-10-01T00:00:00+00:00' }, partes: [
  { parte: { id: '00000000-0000-4000-8000-000000000001', contrato_id: C, rol: 'ARRENDADOR', persona_id: null, persona_moral_id: M }, persona: null, moral: company,
   representantes: [{ vinculo: { id: R, persona_moral_id: M, persona_id: REP, caracter: 'REPRESENTANTE_LEGAL', es_principal: true }, persona: people.rep }] },
  { parte: { id: '00000000-0000-4000-8000-000000000002', contrato_id: C, rol: 'ARRENDATARIO', persona_id: T, persona_moral_id: null }, persona: people.tenant, moral: null, representantes: [] },
  { parte: { id: '00000000-0000-4000-8000-000000000003', contrato_id: C, rol: 'FIADOR', persona_id: G, persona_moral_id: null }, persona: people.guarantor, moral: null, representantes: [] },
 ], unidad: { id: 1, edificio_id: 1, ...unit }, edificio: { id: 1, ...building } });
}
// Generación de la app: misma forma que template.repository/arrendador.repository (PostgREST), sin pasar por las fuentes 2C.
function generationSource() {
 const partes = [['00000000-0000-4000-8000-000000000003', 'FIADOR', people.guarantor], ['00000000-0000-4000-8000-000000000001', 'ARRENDADOR', null, M], ['00000000-0000-4000-8000-000000000002', 'ARRENDATARIO', people.tenant]]
  .map(([id, rol, persona, moral = null]) => ({ id, rol, persona_id: persona?.id ?? null, persona_moral_id: moral, persona }));
 return structuredClone({ contract: { ...contractRow, partes, unidad: { ...unit, edificio: building } }, landlord: company,
  representatives: [{ id: R, caracter: 'REPRESENTANTE_LEGAL', persona: people.rep }], partiesModel: true });
}
const TEMPLATE = '<p>{{arrendador.bloques.comparecencia}} {{arrendatario.nombre_completo}} {{fiador.nombre_completo}} {{contrato.renta}} {{contrato.costo_lavanderia}}</p>';
const PDF = Buffer.from('%PDF-1.7 documento de prueba');
const path = `${C}/${D}/CTR-2026-000001-v1.pdf`;

function fixture() {
 const context = buildContractTemplateContext(generationSource());
 const doc = { id: D, contrato_id: C, version_plantilla_id: V, tipo: 'BORRADOR', estado: 'GENERADO', nombre_archivo: 'CTR-2026-000001-v1.pdf', storage_path: path,
  datos_snapshot: JSON.parse(JSON.stringify(context)), contenido_renderizado: renderContractTemplate(TEMPLATE, context).html };
 const calls = []; const reads = [fuentes(), fuentes()];
 const repo = { document: async () => structuredClone(doc), sources: async () => reads.shift() ?? fuentes(), templateContent: async () => TEMPLATE,
  registerValidation: async input => { calls.push(['register', input]); return 'receipt-1'; } };
 const storage = { assertPrivateBucket: async () => {}, hasPdf: async () => true, download: async () => { calls.push(['download']); return new Uint8Array(PDF); } };
 const starter = { start: async input => { calls.push(['start', input]); return 'process-1'; } };
 return { doc, calls, reads, repo, storage, starter, service: () => createSignatureService(repo, storage, starter) };
}
const noRpc = calls => assert.deepEqual(calls.filter(([name]) => name === 'register' || name === 'start'), []);

describe('inicio de firma: servicio de servidor', () => {
 test('reconstruye desde las fuentes 2C el mismo contexto que la generación de la app', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(buildContractTemplateContext(contextSourceFromSources(fuentes())))), JSON.parse(JSON.stringify(buildContractTemplateContext(generationSource()))));
  assert.deepEqual(identitiesFromSources(fuentes()), [
   { parte_contrato_id: '00000000-0000-4000-8000-000000000001', rol: 'ARRENDADOR', referencia_documento: 'arrendador', entidad_tipo: 'PERSONA_MORAL', entidad_id: M, persona_firmante_id: REP, representante_origen_id: R },
   { parte_contrato_id: '00000000-0000-4000-8000-000000000002', rol: 'ARRENDATARIO', referencia_documento: 'arrendatario', entidad_tipo: 'PERSONA', entidad_id: T, persona_firmante_id: T, representante_origen_id: null },
   { parte_contrato_id: '00000000-0000-4000-8000-000000000003', rol: 'FIADOR', referencia_documento: 'fiador', entidad_tipo: 'PERSONA', entidad_id: G, persona_firmante_id: G, representante_origen_id: null }]);
 });

 test('registra el recibo con hashes calculados en servidor e inicia con ese recibo', async () => {
  const f = fixture();
  assert.deepEqual(await f.service().start(ACTOR, C.toUpperCase(), D), { procesoId: 'process-1' });
  const [[, input], [, started]] = f.calls.filter(([name]) => name !== 'download');
  assert.equal(input.actorId, ACTOR); assert.equal(input.contractId, C); assert.equal(input.documentId, D);
  assert.equal(input.pdfSha256, sha(PDF)); assert.equal(input.pdfBytes, PDF.byteLength);
  assert.equal(input.htmlSha256, sha(f.doc.contenido_renderizado)); assert.equal(input.templateSha256, sha(TEMPLATE));
  assert.equal(input.rendererRevision, 'arrendador-v2-moral-maquetacion-1');
  assert.deepEqual(input.context, f.doc.datos_snapshot); assert.deepEqual(input.sources, fuentes());
  assert.deepEqual(input.identities, identitiesFromSources(fuentes()));
  assert.deepEqual(started, { contractId: C, documentId: D, pdfSha256: sha(PDF), validationId: 'receipt-1' });
 });

 test('documento o contrato no elegibles se rechazan sin descargar ni llamar a las RPC de escritura', async () => {
  for (const [change, code] of [[{ estado: 'ANULADO' }, 'DOCUMENT_NOT_ELIGIBLE'], [{ tipo: 'FIRMADO' }, 'DOCUMENT_NOT_ELIGIBLE'], [{ storage_path: null }, 'PDF_NOT_GENERATED'],
   [{ storage_path: 'otra/ruta.pdf' }, 'PDF_NOT_GENERATED'], [{ version_plantilla_id: null }, 'DOCUMENT_INCOMPLETE'], [{ contrato_id: M }, 'DOCUMENT_NOT_FOUND']]) {
   const f = fixture(); Object.assign(f.doc, change);
   await assert.rejects(f.service().start(ACTOR, C, D), { code }); assert.deepEqual(f.calls, []);
  }
  const f = fixture(); f.reads[0].contrato.estado = 'PENDIENTE_FIRMA';
  await assert.rejects(f.service().start(ACTOR, C, D), { code: 'CONTRACT_NOT_DRAFT', status: 409 }); assert.deepEqual(f.calls, []);
 });

 test('datos cambiados tras generar, durante la verificación o PDF inválido no generan recibo', async () => {
  let f = fixture(); f.reads[0].partes[2].persona.rfc = 'CAMBIADO';
  await assert.rejects(f.service().start(ACTOR, C, D), { code: 'DOCUMENT_OUTDATED' }); assert.deepEqual(f.calls, []);
  f = fixture(); f.doc.contenido_renderizado += ' ';
  await assert.rejects(f.service().start(ACTOR, C, D), { code: 'DOCUMENT_OUTDATED' }); noRpc(f.calls);
  f = fixture(); f.reads[1].partes[1].persona.curp = 'CAMBIADA';
  await assert.rejects(f.service().start(ACTOR, C, D), { code: 'SOURCES_CHANGED' }); noRpc(f.calls);
  for (const bytes of [Buffer.from('<html>no pdf'), Buffer.alloc(0)]) {
   f = fixture(); f.storage.download = async () => new Uint8Array(bytes);
   await assert.rejects(f.service().start(ACTOR, C, D), { code: 'INVALID_PDF' }); noRpc(f.calls);
  }
  f = fixture(); f.storage.hasPdf = async () => false;
  await assert.rejects(f.service().start(ACTOR, C, D), { code: 'PDF_OBJECT_MISSING' }); noRpc(f.calls);
 });

 test('errores de las RPC 2C: rechazo de negocio 409 sin iniciar; permiso 403; otros sin traducir', async () => {
  let f = fixture(); f.repo.registerValidation = async () => { throw { code: 'P0001', message: 'El rol OBLIGADO_SOLIDARIO no está cubierto por la versión de plantilla aprobada' }; };
  await assert.rejects(f.service().start(ACTOR, C, D), { status: 409, code: 'SIGNATURE_REJECTED', message: /OBLIGADO_SOLIDARIO no está cubierto/ });
  assert.deepEqual(f.calls.filter(([name]) => name === 'start'), []);
  f = fixture(); f.starter.start = async () => { throw { code: '42501', message: 'Se requiere administrador autenticado' }; };
  await assert.rejects(f.service().start(ACTOR, C, D), { status: 403, code: 'FORBIDDEN' });
  f = fixture(); f.starter.start = async () => { throw { code: 'XX000', message: 'interno' }; };
  await assert.rejects(f.service().start(ACTOR, C, D), e => !(e instanceof PdfError) && e.code === 'XX000');
 });
});

describe('inicio de firma: endpoint y cliente', () => {
 const call = (deps, init = { method: 'POST' }, contractId = C) => handleSignatureStartRequest(new Request('https://app.test/firma', init), contractId, D, deps);
 test('método, origen, sesión e ID se validan antes de construir el cliente privilegiado', async () => {
  const never = () => { throw Error('must not build service'); };
  for (const [init, status, authorize] of [[{ method: 'GET' }, 405], [{ method: 'POST', headers: { origin: 'https://evil.test' } }, 403], [{ method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }, 403],
   [{ method: 'POST' }, 401, async () => { throw new PdfError(401, 'UNAUTHENTICATED', 'x'); }], [{ method: 'POST' }, 403, async () => { throw new PdfError(403, 'FORBIDDEN', 'x'); }]])
   assert.equal((await call({ authorize: authorize ?? (async () => ACTOR), service: never }, init)).status, status);
  assert.equal((await call({ authorize: async () => ACTOR, service: never }, { method: 'POST' }, '../x')).status, 400);
 });
 test('pasa el actor autenticado, responde sin caché y no filtra errores inesperados', async () => {
  let received;
  const ok = await call({ authorize: async () => ACTOR, service: () => ({ start: async (...args) => { received = args; return { procesoId: 'p' }; } }) });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.deepEqual(await ok.json(), { procesoId: 'p' });
  assert.deepEqual(received, [ACTOR, C, D]);
  const failed = await call({ authorize: async () => ACTOR, service: () => ({ start: async () => { throw Error('service-role-secret'); } }) });
  assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /service-role-secret/);
 });
 test('elegibilidad visible y código cliente sin credenciales privilegiadas', () => {
  const doc = { tipo: 'BORRADOR', estado: 'GENERADO', storage_path: path };
  assert.equal(canStartSignature('BORRADOR', doc), true); assert.equal(canStartSignature('BORRADOR', { ...doc, tipo: 'PARA_FIRMA' }), true);
  for (const [status, change] of [['PENDIENTE_FIRMA', {}], [undefined, {}], ['BORRADOR', { storage_path: null }], ['BORRADOR', { estado: 'ANULADO' }], ['BORRADOR', { tipo: 'FIRMADO' }]])
   assert.equal(canStartSignature(status, { ...doc, ...change }), false);
  for (const file of ['firmas/services/firma.client.ts', 'firmas/hooks/useStartSignature.ts', 'firmas/hooks/useSignatureProcess.ts', 'firmas/repositories/firmas.repository.ts', 'firmas/components/StartSignatureAction.tsx', 'firmas/components/SignatureProcessPanel.tsx', 'firmas/model.ts', 'documentos/components/ContractDocuments.tsx', 'ContractDetailPage.tsx'])
   assert.doesNotMatch(read(mod + file), /SERVICE_ROLE|service_role|serviceClient|\/server\/|registrar_validacion|iniciar_proceso_firma/, file);
  assert.match(read('../src/pages/api/admin/arrendamiento/contratos/[contratoId]/documentos/[documentoId]/firma.ts'), /prerender = false/);
  assert.match(read('../src/pages/api/admin/arrendamiento/contratos/[contratoId]/firmas/[procesoId]/cancelar.ts'), /prerender = false/);
  // Cancelar usa solo la sesión del administrador: ni service_role ni su fábrica.
  const deps = read(mod + 'firmas/server/dependencies.ts'); const cancelDeps = deps.slice(deps.indexOf('export function cancellationRequestDependencies'));
  assert.doesNotMatch(cancelDeps, /createServiceRoleClient|signatureRepository|privatePdfStorage/);
 });
});

describe('cancelación de firma: servicio y endpoint', () => {
 const P = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
 function cancelFixture(process = { id: P, contrato_id: C, estado: 'PENDIENTE' }) {
  const calls = [];
  const repo = { process: async id => { calls.push(['process', id]); return process; }, cancel: async (id, reason) => { calls.push(['cancel', id, reason]); } };
  return { calls, repo, service: () => createCancellationService(repo) };
 }
 test('cancela con el motivo recortado tras comprobar contrato y estado', async () => {
  const f = cancelFixture();
  assert.deepEqual(await f.service().cancel(C.toUpperCase(), P, '  Datos erróneos '), { procesoId: P, estado: 'CANCELADO' });
  assert.deepEqual(f.calls, [['process', P], ['cancel', P, 'Datos erróneos']]);
 });
 test('motivo inválido, proceso ajeno, inexistente o no pendiente: sin llamar a la RPC', async () => {
  for (const reason of ['', '   ', 'x'.repeat(1001), null, 42]) { const f = cancelFixture(); await assert.rejects(f.service().cancel(C, P, reason), { status: 400, code: 'INVALID_REASON' }); assert.deepEqual(f.calls, []); }
  for (const [process, status, code] of [[null, 404, 'PROCESS_NOT_FOUND'], [{ id: P, contrato_id: D, estado: 'PENDIENTE' }, 404, 'PROCESS_NOT_FOUND'],
   [{ id: P, contrato_id: C, estado: 'CANCELADO' }, 409, 'PROCESS_NOT_PENDING'], [{ id: P, contrato_id: C, estado: 'COMPLETADO' }, 409, 'PROCESS_NOT_PENDING']]) {
   const f = cancelFixture(process); await assert.rejects(f.service().cancel(C, P, 'motivo'), { status, code }); assert.deepEqual(f.calls.filter(([n]) => n === 'cancel'), []);
  }
 });
 test('errores de cancelar_proceso_firma: negocio 409 con su mensaje, permiso 403, otros sin traducir', async () => {
  for (const [error, check] of [[{ code: 'P0001', message: 'Proceso con firmas/evidencias requiere resolución posterior explícita' }, { status: 409, message: /firmas\/evidencias/ }],
   [{ code: '42501', message: 'Se requiere administrador autenticado' }, { status: 403, code: 'FORBIDDEN' }], [{ code: 'XX000', message: 'interno' }, e => !(e instanceof PdfError)]]) {
   const f = cancelFixture(); f.repo.cancel = async () => { throw error; };
   await assert.rejects(f.service().cancel(C, P, 'motivo'), check);
  }
 });
 const call = (deps, init, processId = P) => handleSignatureCancelRequest(new Request('https://app.test/cancelar', init), C, processId, deps);
 const json = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
 test('endpoint: método, origen, sesión, ID y cuerpo se validan antes de construir el servicio', async () => {
  const never = () => { throw Error('must not build service'); };
  const admin = async () => ACTOR;
  for (const [init, status, authorize = admin, processId] of [[{ method: 'GET' }, 405], [{ ...json({ motivo: 'x' }), headers: { 'content-type': 'application/json', origin: 'https://evil.test' } }, 403],
   [json({ motivo: 'x' }), 401, async () => { throw new PdfError(401, 'UNAUTHENTICATED', 'x'); }], [json({ motivo: 'x' }), 403, async () => { throw new PdfError(403, 'FORBIDDEN', 'x'); }],
   [json({ motivo: 'x' }), 400, admin, 'no-uuid'], [{ method: 'POST', body: '{"motivo":"x"}' }, 400], [{ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }, 400],
   [json({}), 400], [json({ motivo: '  ' }), 400], [json({ motivo: 'x'.repeat(1001) }), 400]])
   assert.equal((await call({ authorize, service: never }, init, processId)).status, status);
 });
 test('endpoint: devuelve el estado y no filtra errores inesperados', async () => {
  let received;
  const ok = await call({ authorize: async () => ACTOR, service: () => ({ cancel: async (...args) => { received = args; return { procesoId: P, estado: 'CANCELADO' }; } }) }, json({ motivo: ' Motivo ' }));
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { procesoId: P, estado: 'CANCELADO' }); assert.deepEqual(received, [C, P, 'Motivo']);
  const failed = await call({ authorize: async () => ACTOR, service: () => ({ cancel: async () => { throw Error('jwt-secret'); } }) }, json({ motivo: 'x' }));
  assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /jwt-secret/);
 });
});

// Integración con las RPC 2C reales instaladas en PGlite y la plantilla V2 del repositorio.
describe('inicio de firma: integración con la infraestructura 2C (PGlite)', () => {
 const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', COMPANY = '22222222-2222-4222-8222-222222222222', TEMPLATE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 const V2 = read('../docs/plantillas/contrato-habitacional-v2-final.html'), V2_ID = '599b36af-5464-43bc-acf8-a6a72afaf2ef';
 let db; const objects = new Map();
 async function as(role, fn, sub) {
  if (sub !== undefined) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec('reset role'); }
 }
 const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
 before(async () => {
  db = new PGlite();
  await db.exec(read('./fixtures/partes-schema.sql').replaceAll('fixture_contract_folio_seq', 'contratos_folio_seq'));
  await db.exec(read('../docs/sql/partes-2b0/01_esquema.sql'));
  const hash = (await rows("select md5(pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure)) h"))[0].h;
  await db.exec(read('../docs/sql/partes-2b0/02_rpc.sql').replace('c1e2e7ed4a9dd613bbbbe06f4dae50b7', hash));
  await db.exec(read('./fixtures/firmas-2c-schema.sql'));
  await as('propietario_sim', () => db.exec(read('../docs/sql/firmas-2c/02_infraestructura_corregida.sql')));
  await db.query("insert into versiones_plantilla values($1,$2,2,'BORRADOR',$3)", [V2_ID, TEMPLATE_ID, V2]);
  // Misma cobertura registrada en Supabase: ARRENDADOR 1..1 moral, ARRENDATARIO 1..1, FIADOR 0..1.
  await as('propietario_sim', () => db.query("select firma_privada.registrar_cobertura_plantilla($1,$2,$3::jsonb,'Aprobación jurídica de prueba')", [V2_ID, sha(V2), JSON.stringify([
   { rol: 'ARRENDADOR', minimo: 1, maximo: 1, entidades: ['PERSONA_MORAL'] }, { rol: 'ARRENDATARIO', minimo: 1, maximo: 1, entidades: ['PERSONA'] }, { rol: 'FIADOR', minimo: 0, maximo: 1, entidades: ['PERSONA'] }])]));
 });
 after(async () => db?.close());
 const repo = { // Adaptador PGlite de signatureRepository: mismas RPC y consultas, como service_role.
  sources: id => as('service_role', async () => (await rows('select firma_fuentes_para_verificar($1) f', [id]))[0].f),
  document: (c, d) => as('service_role', async () => (await rows('select id,contrato_id,version_plantilla_id,tipo,estado,nombre_archivo,storage_path,datos_snapshot,contenido_renderizado from documentos_contrato where id=$1 and contrato_id=$2', [d, c]))[0] ?? null),
  templateContent: id => as('service_role', async () => (await rows('select contenido from versiones_plantilla where id=$1', [id]))[0]?.contenido ?? null),
  registerValidation: i => as('service_role', async () => (await rows('select registrar_validacion_documento_firma($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb) id',
   [i.actorId, i.contractId, i.documentId, i.pdfSha256, i.pdfBytes, JSON.stringify(i.sources), JSON.stringify(i.context), i.htmlSha256, i.templateSha256, i.rendererRevision, JSON.stringify(i.identities)]))[0].id),
 };
 const starter = { start: i => as('authenticated', async () => (await rows('select iniciar_proceso_firma($1,$2,$3,$4) id', [i.contractId, i.documentId, i.pdfSha256, i.validationId]))[0].id, ADMIN) };
 const storage = { assertPrivateBucket: async () => {}, hasPdf: async p => objects.has(p), download: async p => objects.get(p) };
 const service = () => createSignatureService(repo, storage, starter);
 // Genera como la app: contexto desde la forma PostgREST de los repositorios, render V2, inserción y PDF vinculado.
 async function generatedDocument({ guarantor = true } = {}) {
  const app = randomUUID();
  await db.query("insert into solicitudes values($1,1,'aprobada')", [app]);
  await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,'33333333-3333-4333-8333-333333333333','solicitante')", [app]);
  if (guarantor) await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,'44444444-4444-4444-8444-444444444444','fiador')", [app]);
  const contractId = (await as('authenticated', () => rows("select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,12000::numeric,12000::numeric,1::integer,'PERSONA_MORAL',$2::uuid) id", [app, COMPANY]), ADMIN))[0].id;
  const personJson = alias => `(select json_build_object('id',${alias}.id,'nombre',${alias}.nombre,'apellido_paterno',${alias}.apellido_paterno,'apellido_materno',${alias}.apellido_materno,'rfc',${alias}.rfc,'curp',${alias}.curp,'domicilio_origen',${alias}.domicilio_origen,'telefono',${alias}.telefono,'correo',${alias}.correo) from personas ${alias}`;
  const [source] = await rows(`select json_build_object('id',c.id,'estado',c.estado,'arrendador_persona_moral_id',c.arrendador_persona_moral_id,'folio',c.folio,'fecha_inicio',c.fecha_inicio,'fecha_fin',c.fecha_fin,
   'renta',c.renta,'deposito',c.deposito,'dia_pago',c.dia_pago,'fecha_firma',c.fecha_firma,'lugar_firma',c.lugar_firma,'costo_lavanderia',c.costo_lavanderia,'domicilio_arrendador',c.domicilio_arrendador,
   'domicilio_arrendatario',c.domicilio_arrendatario,'domicilio_fiador',c.domicilio_fiador,
   'partes',(select json_agg(json_build_object('id',p.id,'rol',p.rol,'persona_id',p.persona_id,'persona_moral_id',p.persona_moral_id,'persona',${personJson('pe')} where pe.id=p.persona_id))) from partes_contrato p where p.contrato_id=c.id),
   'unidad',(select json_build_object('nombre',u.nombre,'numero',u.numero,'tipo',u.tipo,'piso',u.piso,'ubicacion',u.ubicacion,'edificio',(select to_json(e) from edificios e where e.id=u.edificio_id)) from unidades u where u.id=c.unidad_id)) contract,
   (select to_json(m) from personas_morales m where m.id=$2) landlord,
   (select json_agg(json_build_object('id',r.id,'caracter',r.caracter,'persona',${personJson('rp')} where rp.id=r.persona_id))) from representantes_persona_moral r where r.persona_moral_id=$2 and r.es_principal) representatives
   from contratos c where c.id=$1`, [contractId, COMPANY]);
  const context = buildContractTemplateContext({ ...source, partiesModel: true });
  const { html, unresolvedVariables } = renderContractTemplate(V2, context);
  assert.deepEqual(unresolvedVariables, []);
  const documentId = (await as('authenticated', () => rows(`insert into documentos_contrato(contrato_id,version_plantilla_id,numero_version,tipo,estado,nombre_archivo,storage_path,datos_snapshot,contenido_renderizado,generated_at)
   values($1,$2,1,'BORRADOR','GENERADO',$3,null,$4::jsonb,$5,'now') returning id`, [contractId, V2_ID, `${source.contract.folio}-v1.pdf`, JSON.stringify(context), html]), ADMIN))[0].id;
  const pdfPath = `${contractId}/${documentId}/${source.contract.folio}-v1.pdf`;
  await as('service_role', () => db.query('update documentos_contrato set storage_path=$2 where id=$1', [documentId, pdfPath]));
  objects.set(pdfPath, new Uint8Array(Buffer.from(`%PDF-1.7 ${documentId}`)));
  return { contractId, documentId };
 }
 const contractState = async id => (await rows('select estado from contratos where id=$1', [id]))[0].estado;

 test('inicia el proceso con las RPC reales: contrato PENDIENTE_FIRMA, documento PARA_FIRMA y un firmante por parte', async () => {
  const { contractId, documentId } = await generatedDocument();
  const { procesoId } = await service().start(ADMIN, contractId, documentId);
  assert.equal(await contractState(contractId), 'PENDIENTE_FIRMA');
  assert.equal((await rows('select tipo from documentos_contrato where id=$1', [documentId]))[0].tipo, 'PARA_FIRMA');
  const process = (await rows('select contrato_id,documento_origen_id,version_plantilla_id,sha256_plantilla,iniciado_por,estado from procesos_firma where id=$1', [procesoId]))[0];
  assert.deepEqual(process, { contrato_id: contractId, documento_origen_id: documentId, version_plantilla_id: V2_ID, sha256_plantilla: sha(V2), iniciado_por: ADMIN, estado: 'PENDIENTE' });
  assert.deepEqual((await rows('select rol from firmantes_proceso where proceso_firma_id=$1 order by rol', [procesoId])).map(r => r.rol), ['ARRENDADOR', 'ARRENDATARIO', 'FIADOR']);
  await assert.rejects(service().start(ADMIN, contractId, documentId), { code: 'CONTRACT_NOT_DRAFT' });
 });

 test('sin fiador también firma (FIADOR 0..1)', async () => {
  const { contractId, documentId } = await generatedDocument({ guarantor: false });
  await service().start(ADMIN, contractId, documentId);
  assert.equal(await contractState(contractId), 'PENDIENTE_FIRMA');
 });

 test('datos modificados tras generar: rechazo en servidor sin recibo ni cambio de estado', async () => {
  const { contractId, documentId } = await generatedDocument();
  const receiptsBefore = (await as('propietario_sim', () => rows('select count(*)::int n from firma_privada.validaciones')))[0].n;
  await db.query("update personas set rfc='OTRO000000XXX' where id='33333333-3333-4333-8333-333333333333'");
  try {
   await assert.rejects(service().start(ADMIN, contractId, documentId), { code: 'DOCUMENT_OUTDATED' });
   assert.equal(await contractState(contractId), 'BORRADOR');
   assert.equal((await as('propietario_sim', () => rows('select count(*)::int n from firma_privada.validaciones')))[0].n, receiptsBefore);
  } finally { await db.query("update personas set rfc='GOMS900101BBB' where id='33333333-3333-4333-8333-333333333333'"); }
 });

 test('un usuario no administrador no puede iniciar aunque el servidor registre el recibo', async () => {
  const { contractId, documentId } = await generatedDocument();
  const userStarter = { start: i => as('authenticated', async () => (await rows('select iniciar_proceso_firma($1,$2,$3,$4) id', [i.contractId, i.documentId, i.pdfSha256, i.validationId]))[0].id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') };
  await assert.rejects(createSignatureService(repo, storage, userStarter).start(ADMIN, contractId, documentId), { status: 403 });
  assert.equal(await contractState(contractId), 'BORRADOR');
 });
 // Adaptador PGlite de cancellationRepository: la sesión del usuario (rol authenticated + sub), como en producción.
 const cancellation = sub => createCancellationService({
  process: id => as('authenticated', async () => (await rows('select id,contrato_id,estado from procesos_firma where id=$1', [id]))[0] ?? null, sub),
  cancel: (id, reason) => as('authenticated', async () => { await db.query('select cancelar_proceso_firma($1,$2)', [id, reason]); }, sub),
 });
 test('cancela con la RPC real: contrato a BORRADOR, motivo y autor registrados, documento reutilizable', async () => {
  const { contractId, documentId } = await generatedDocument();
  const { procesoId } = await service().start(ADMIN, contractId, documentId);
  // Otro usuario autenticado no administrador: la RLS oculta el proceso y no se llama a la RPC.
  await assert.rejects(cancellation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb').cancel(contractId, procesoId, 'Intento'), { status: 404 });
  await assert.rejects(cancellation(ADMIN).cancel(randomUUID(), procesoId, 'Ruta de otro contrato'), { status: 404 });
  assert.equal(await contractState(contractId), 'PENDIENTE_FIRMA');
  assert.deepEqual(await cancellation(ADMIN).cancel(contractId, procesoId, '  Prueba de cancelación '), { procesoId, estado: 'CANCELADO' });
  assert.equal(await contractState(contractId), 'BORRADOR');
  assert.deepEqual((await rows('select estado,cancelado_por,motivo_cancelacion from procesos_firma where id=$1', [procesoId]))[0], { estado: 'CANCELADO', cancelado_por: ADMIN, motivo_cancelacion: 'Prueba de cancelación' });
  assert.equal((await rows('select tipo from documentos_contrato where id=$1', [documentId]))[0].tipo, 'PARA_FIRMA');
  await assert.rejects(cancellation(ADMIN).cancel(contractId, procesoId, 'Otra vez'), { status: 409, code: 'PROCESS_NOT_PENDING' });
  // El PARA_FIRMA de un proceso cancelado vuelve a ser elegible con un recibo nuevo.
  const second = await service().start(ADMIN, contractId, documentId);
  assert.notEqual(second.procesoId, procesoId); assert.equal(await contractState(contractId), 'PENDIENTE_FIRMA');
 });
 test('la RPC real rechaza cancelar sin sesión de administrador aunque el servidor no lo detectara', async () => {
  const { contractId, documentId } = await generatedDocument();
  const { procesoId } = await service().start(ADMIN, contractId, documentId);
  const bypass = createCancellationService({ process: async () => ({ id: procesoId, contrato_id: contractId, estado: 'PENDIENTE' }),
   cancel: (id, reason) => as('authenticated', async () => { await db.query('select cancelar_proceso_firma($1,$2)', [id, reason]); }, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') });
  await assert.rejects(bypass.cancel(contractId, procesoId, 'motivo'), { status: 403, code: 'FORBIDDEN' });
  assert.equal(await contractState(contractId), 'PENDIENTE_FIRMA');
 });
});

