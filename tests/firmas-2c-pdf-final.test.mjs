import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import pngjs from 'pngjs';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { chromium } from 'playwright-core';
// PDF final de 2C con PDFs y PNG reales, las RPC reales de 07 en PGlite y el cliente real de Supabase Storage contra un
// servidor HTTP local que guarda bytes y aplica upsert=false. Jamás contra Supabase.
registerHooks({ resolve(specifier, context, next) {
 if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
 if (context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !/\.tsx?$/.test(specifier)) return next(`${specifier}.ts`, context);
 return next(specifier, context);
} });
const mod = '../src/modules/admin/arrendamiento/contratos/';
const { validateDrawnSignature, decodeSignatureBase64 } = await import(`${mod}firmas/server/drawnSignature.ts`);
const { buildFinalSignedPdf, sha256Hex, FINAL_PDF_MANIFEST_NAME } = await import(`${mod}firmas/server/finalPdf.ts`);
const { signerCharacterLabel, signerRoleLabel } = await import(`${mod}firmas/signerLabels.ts`);
const { representativeCharacters } = await import('../src/modules/admin/configuracion/arrendador/types.ts');
const { createFinalPdfService } = await import(`${mod}firmas/server/finalPdfService.ts`);
const { createSigningService } = await import(`${mod}firmas/server/signingService.ts`);
const { finalPdfRepository, signingRepository } = await import(`${mod}firmas/server/finalPdfRepository.ts`);
const { handleFinalPdfReadRequest, handleFinalPdfRecoveryRequest } = await import(`${mod}firmas/server/finalPdfRequest.ts`);
const { privatePdfStorage } = await import(`${mod}documentos/server/storage/privateStorage.ts`);
const { PdfError } = await import(`${mod}documentos/server/errors.ts`);
const { generatePdfFromHtml } = await import(`${mod}documentos/server/pdf/generator.ts`);

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const STAGE1 = read('../docs/sql/firmas-2c/02_infraestructura_corregida.sql');
const ESF = read('../docs/sql/firmas-2c/07_firma_electronica_simple.sql');
const SECRET = 'secreto-de-servidor-solo-para-pruebas';
const ids = {
 admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', company: '22222222-2222-4222-8222-222222222222',
 rep: '11111111-1111-4111-8111-111111111111', tenant: '33333333-3333-4333-8333-333333333333', guarantor: '44444444-4444-4444-8444-444444444444',
 template: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', v2: 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2',
};
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

// ---------------------------------------------------------------- imágenes y PDFs reales
const RED = [220, 20, 20], GREEN = [10, 170, 40], BLUE = [20, 40, 230], BLACK = [15, 15, 15];
function canvas(width, height, paint) {
 const png = new pngjs.PNG({ width, height });
 png.data.fill(0);
 const put = (x, y, [r, g, b], a = 255) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4; png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a;
 };
 paint(put);
 return pngjs.PNG.sync.write(png);
}
// Trazo continuo y grueso, como el de un lienzo real.
const scribble = (color = BLACK, width = 600, height = 200) => canvas(width, height, put => {
 for (let x = 20; x < width - 20; x++) {
  const y = Math.round(height / 2 + Math.sin(x / 25) * (height / 3));
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) put(x + dx, y + dy, color);
 }
});
async function realPdf(pages = 2, marker = 'Clausula del contrato') {
 const doc = await PDFDocument.create();
 const font = await doc.embedFont(StandardFonts.Helvetica);
 for (let n = 1; n <= pages; n++) doc.addPage([612, 792]).drawText(`${marker} pagina ${n} ${randomUUID()}`, { x: 60, y: 700, size: 12, font });
 return doc.save();
}
async function open(bytes) { return getDocument({ data: new Uint8Array(bytes), verbosity: 0, useSystemFonts: false, disableFontFace: true }).promise; }
async function pageText(pdf, number) { return (await (await pdf.getPage(number)).getTextContent()).items.map(item => item.str).join(' '); }
async function pdfText(bytes) {
 const pdf = await open(bytes);
 const pages = [];
 for (let n = 1; n <= pdf.numPages; n++) pages.push(await pageText(pdf, n));
 return { pages, count: pdf.numPages, pdf };
}
// Rasteriza una página y cuenta los píxeles de un color: comprueba lo que se ve, no solo lo que hay en el archivo.
async function countColor(pdf, number, [r, g, b]) {
 const page = await pdf.getPage(number);
 const viewport = page.getViewport({ scale: 2 });
 const surface = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
 const context = surface.getContext('2d');
 context.fillStyle = '#fff'; context.fillRect(0, 0, surface.width, surface.height);
 await page.render({ canvasContext: context, canvas: surface, viewport }).promise;
 const { data } = context.getImageData(0, 0, surface.width, surface.height);
 let count = 0;
 for (let i = 0; i < data.length; i += 4) if (Math.abs(data[i] - r) < 45 && Math.abs(data[i + 1] - g) < 45 && Math.abs(data[i + 2] - b) < 45) count++;
 return count;
}

// ---------------------------------------------------------------- validación del PNG
describe('validación real de la firma dibujada', () => {
 const rejects = (png, code) => assert.throws(() => validateDrawnSignature(png), err => err instanceof PdfError && err.code === code && err.status === 422);
 test('acepta un trazo real y mide lo que se verá', () => {
  const metrics = validateDrawnSignature(scribble());
  assert.ok(metrics.inkPixels > 1000 && metrics.inkRatio < 0.35 && metrics.largestStroke > 1000 && metrics.inkHeight > 50);
 });
 test('acepta PNG opacos con fondo blanco, como los de un lienzo sin transparencia', () => {
  validateDrawnSignature(canvas(600, 200, put => {
   for (let y = 0; y < 200; y++) for (let x = 0; x < 600; x++) put(x, y, [255, 255, 255]);
   for (let x = 30; x < 570; x++) for (let w = -2; w <= 2; w++) put(x, Math.round(100 + Math.sin(x / 30) * 60) + w, BLACK);
  }));
 });
 test('rechaza lienzos vacíos o sin trazos', () => {
  rejects(canvas(600, 200, () => {}), 'DRAWN_SIGNATURE_EMPTY');
  // Trazo continuo y con extensión, pero tan fino y corto que no llega a la tinta mínima.
  rejects(canvas(600, 200, put => { for (let n = 0; n < 60; n++) put(100 + n, 100 + Math.round(n / 5), BLACK); }), 'DRAWN_SIGNATURE_EMPTY');
  rejects(canvas(600, 200, put => { for (let y = 0; y < 200; y++) for (let x = 0; x < 600; x++) put(x, y, [255, 255, 255]); }), 'DRAWN_SIGNATURE_EMPTY');
  rejects(canvas(600, 200, put => { for (let y = 90; y < 110; y++) for (let x = 290; x < 310; x++) put(x, y, BLACK); }), 'DRAWN_SIGNATURE_EMPTY');
  rejects(canvas(600, 200, put => { for (let y = 98; y < 102; y++) for (let x = 20; x < 580; x++) put(x, y, BLACK); }), 'DRAWN_SIGNATURE_EMPTY');
  rejects(canvas(600, 200, put => { for (let n = 0; n < 2000; n++) put((n * 37) % 600, (n * 91) % 200, BLACK); }), 'DRAWN_SIGNATURE_EMPTY');
  rejects(canvas(600, 200, put => { for (let y = 0; y < 200; y++) for (let x = 0; x < 600; x++) put(x, y, BLACK); }), 'DRAWN_SIGNATURE_EMPTY');
 });
 test('un trazo blanco o transparente no cuenta, porque no se vería en el PDF', () => {
  rejects(scribble([255, 255, 255]), 'DRAWN_SIGNATURE_EMPTY');
  rejects(canvas(600, 200, put => { for (let x = 20; x < 580; x++) for (let w = -2; w <= 2; w++) put(x, Math.round(100 + Math.sin(x / 25) * 60) + w, BLACK, 5); }), 'DRAWN_SIGNATURE_EMPTY');
 });
 test('rechaza lo que no es un PNG íntegro y dentro de los límites', () => {
  const good = scribble();
  rejects(Buffer.from('%PDF-1.7'.padEnd(200, 'x')), 'DRAWN_SIGNATURE_INVALID');
  rejects(good.subarray(0, Math.floor(good.length / 2)), 'DRAWN_SIGNATURE_INVALID');
  const flipped = Buffer.from(good); flipped[good.length - 20] ^= 0xff;
  rejects(flipped, 'DRAWN_SIGNATURE_INVALID');
  rejects(scribble(BLACK, 100, 40), 'DRAWN_SIGNATURE_INVALID');
  // Dimensiones enormes declaradas en la cabecera: se rechaza sin reservar memoria.
  assert.throws(() => validateDrawnSignature(scribble(BLACK, 3000, 1600)), err => err.code === 'DRAWN_SIGNATURE_INVALID' && /dimensiones/.test(err.message));
  const bomb = Buffer.from(good); bomb.writeUInt32BE(50000, 16); bomb.writeUInt32BE(50000, 20);
  rejects(bomb, 'DRAWN_SIGNATURE_INVALID');
  const interlaced = Buffer.from(good); interlaced[28] = 1;
  rejects(interlaced, 'DRAWN_SIGNATURE_INVALID');
  rejects(Buffer.concat([good, Buffer.alloc(262145)]), 'DRAWN_SIGNATURE_INVALID');
  assert.throws(() => decodeSignatureBase64('***no base64***'), err => err.code === 'DRAWN_SIGNATURE_INVALID');
  assert.throws(() => decodeSignatureBase64('A'.repeat(400000)), err => err.code === 'DRAWN_SIGNATURE_INVALID');
 });
});

// ---------------------------------------------------------------- generación
const entry = (i, name, png, overrides = {}) => ({ firma_id: randomUUID(), firmante_id: `00000000-0000-4000-8000-00000000000${i}`, rol: 'ARRENDATARIO', caracter: 'POR_DERECHO_PROPIO', nombre_entidad: name,
 persona_firmante_id: randomUUID(), nombre_firmante: name, firmado_at: `2026-11-03T12:00:0${i}.000000Z`, sha256_documento: 'a'.repeat(64), sha256_firma: sha256Hex(png), sha256_evidencia: sha(`e${i}`), ...overrides });
function dataFor(entries, pngs, origin) {
 return { proceso_id: randomUUID(), contrato_id: randomUUID(), documento_id: randomUUID(), storage_path_origen: 'x', sha256_documento_origen: origin, ruta_pdf_final: 'y', manifiesto: entries, sha256_manifiesto: sha('m'),
  imagenes: entries.map((e, i) => ({ firma_id: e.firma_id, mime_type: 'image/png', imagen_base64: Buffer.from(pngs[i]).toString('base64'), sha256_firma: e.sha256_firma })) };
}
describe('generación del PDF final', () => {
 test('conserva las páginas originales y añade firmas visibles, sus datos y el manifiesto', async () => {
  const original = await realPdf(3);
  const pngs = [scribble(RED), scribble(GREEN), scribble(BLUE)];
  const entries = [entry(1, 'Ana Pérez', pngs[0]), entry(2, 'Luis Núñez', pngs[1], { rol: 'FIADOR' }),
   entry(3, 'Manuel Ruiz', pngs[2], { rol: 'ARRENDADOR', nombre_entidad: 'Empresa SA de CV', caracter: 'REPRESENTANTE_LEGAL' })];
  const data = dataFor(entries, pngs, sha256Hex(original));
  const final = await buildFinalSignedPdf({ original, data, folio: 'CTR-2026-000001' });
  const before = await pdfText(original), after = await pdfText(final);
  assert.equal(after.count, 4);
  for (let n = 0; n < 3; n++) assert.equal(after.pages[n], before.pages[n]);
  const sheet = after.pages[3];
  for (const text of ['CTR-2026-000001', 'Ana Pérez', 'Luis Núñez', 'Manuel Ruiz', 'Empresa SA de CV', data.sha256_documento_origen, data.sha256_manifiesto, ...entries.map(e => e.sha256_firma), ...entries.map(e => e.sha256_evidencia), 'no es un dictamen']) {
   assert.ok(sheet.includes(text), text);
  }
  for (const color of [RED, GREEN, BLUE]) {
   assert.ok(await countColor(after.pdf, 4, color) > 300, `firma de color ${color} visible`);
   assert.equal(await countColor(after.pdf, 1, color), 0, 'las páginas originales no cambian');
  }
  const attachments = await after.pdf.getAttachments();
  const manifest = JSON.parse(Buffer.from(attachments[FINAL_PDF_MANIFEST_NAME].content).toString());
  assert.deepEqual(manifest, { sha256_documento_origen: data.sha256_documento_origen, sha256_manifiesto: data.sha256_manifiesto, firmas: entries });
  assert.notEqual(sha256Hex(final), data.sha256_documento_origen);
 });

 test('con muchos firmantes continúa en otra hoja sin perder ninguna firma', async () => {
  const colors = [RED, GREEN, BLUE, [230, 130, 10], [150, 20, 170], [10, 170, 170]];
  const pngs = colors.map(color => scribble(color));
  const entries = pngs.map((png, i) => entry(i + 1, `Firmante ${i + 1}`, png));
  const final = await buildFinalSignedPdf({ original: await realPdf(1), data: dataFor(entries, pngs, sha('o')), folio: null });
  const { count, pages, pdf } = await pdfText(final);
  assert.ok(count >= 3);
  for (let i = 0; i < colors.length; i++) {
   assert.ok(pages.slice(1).join(' ').includes(`Firmante ${i + 1}`));
   let visible = 0;
   for (let n = 2; n <= count; n++) visible += await countColor(pdf, n, colors[i]);
   assert.ok(visible > 300, `firma ${i + 1} visible`);
  }
 });

 const CHARACTERS = { REPRESENTANTE_LEGAL: 'Representante legal', APODERADO_LEGAL: 'Apoderado legal', ADMINISTRADOR: 'Administrador', OTRO: null };
 async function constancia(caracter) {
  const png = scribble();
  const entries = [entry(1, 'Manuel Ruiz', png, { rol: 'ARRENDADOR', nombre_entidad: 'Empresa SA de CV', caracter })];
  const final = await buildFinalSignedPdf({ original: await realPdf(1), data: dataFor(entries, [png], sha('o')), folio: 'CTR-1' });
  const pdf = await open(final);
  const items = (await (await pdf.getPage(2)).getTextContent()).items.filter(item => item.str.trim());
  return { text: items.map(item => item.str).join(' '), items, final };
 }
 const yOf = (items, start) => items.find(item => item.str.startsWith(start)).transform[5];

 test('etiquetas compartidas: cubren todo el catálogo, sin códigos, y OTRO no tiene etiqueta', () => {
  assert.deepEqual(Object.keys(CHARACTERS).sort(), Object.keys(representativeCharacters).sort(), 'la prueba cubre todo el catálogo');
  for (const [code, expected] of Object.entries(CHARACTERS)) assert.equal(signerCharacterLabel(code), expected, code);
  assert.equal(signerCharacterLabel('POR_DERECHO_PROPIO'), 'Por derecho propio');
  assert.equal(signerCharacterLabel('APODERADO_ESPECIAL'), null, 'otro código no se muestra');
  assert.equal(signerCharacterLabel('Apoderado General'), 'Apoderado General', 'el texto libre no se transforma');
  for (const [code, expected] of [['ARRENDADOR', 'Arrendador'], ['ARRENDATARIO', 'Arrendatario'], ['FIADOR', 'Fiador'], ['OBLIGADO_SOLIDARIO', 'Obligado solidario'], ['REPRESENTANTE_LEGAL', 'Representante legal'], ['ROL_NUEVO', 'Firmante']]) assert.equal(signerRoleLabel(code), expected);
 });

 test('constancia: cada valor del catálogo con su etiqueta y sin códigos internos', async () => {
  for (const [code, expected] of Object.entries(CHARACTERS)) {
   const { text } = await constancia(code);
   for (const internal of Object.keys(CHARACTERS)) assert.ok(!text.includes(internal), `${code}: aparece ${internal}`);
   assert.doesNotMatch(text, /[A-Z]+_[A-Z]+/, code);
   assert.ok(text.includes('Arrendador: Manuel Ruiz'), code);
   if (expected) assert.ok(text.includes(`Carácter: ${expected}`), code);
  }
 });

 test('constancia con OTRO: sin línea de carácter, sin hueco, y el resto de la evidencia intacto', async () => {
  const { text, items } = await constancia('OTRO');
  assert.ok(!text.includes('Carácter'), 'sin línea de carácter');
  assert.doesNotMatch(text, /\bOtro\b|\bOTRO\b/);
  for (const present of ['En representación de Empresa SA de CV', 'Firmado (UTC):', 'SHA-256 de la firma:', 'SHA-256 de la evidencia:']) assert.ok(text.includes(present), present);
  // Mismo interlineado entre las líneas que quedan juntas: la línea omitida no deja un espacio en blanco.
  const normal = await constancia('APODERADO_LEGAL');
  assert.equal(Math.round(yOf(normal.items, 'Carácter:') - yOf(normal.items, 'Firmado')), 12);
  assert.equal(Math.round(yOf(items, 'En representación') - yOf(items, 'Firmado')), 12, 'sin hueco');
 });

 test('un nombre fuera de WinAnsi no impide generar: el exacto queda en el manifiesto', async () => {
  const png = scribble();
  const entries = [entry(1, 'Łukasz 李 Pérez', png)];
  const final = await buildFinalSignedPdf({ original: await realPdf(1), data: dataFor(entries, [png], sha('o')), folio: null });
  const { pages, pdf } = await pdfText(final);
  assert.ok(pages[1].includes('Pérez'));
  const attachments = await pdf.getAttachments();
  assert.equal(JSON.parse(Buffer.from(attachments[FINAL_PDF_MANIFEST_NAME].content).toString()).firmas[0].nombre_firmante, 'Łukasz 李 Pérez');
 });

 test('no genera con una imagen que no coincide con su hash, ausente o dañada, ni desde un PDF ilegible', async () => {
  const png = scribble(), original = await realPdf(1);
  const entries = [entry(1, 'Ana', png)];
  const build = data => buildFinalSignedPdf({ original, data, folio: null });
  await assert.rejects(build({ ...dataFor(entries, [png], sha('o')), imagenes: [] }), err => err.code === 'FINAL_PDF_SIGNATURE_MISSING');
  await assert.rejects(build(dataFor(entries, [scribble(RED)], sha('o'))), err => err.code === 'FINAL_PDF_SIGNATURE_MISMATCH');
  const broken = Buffer.from(png); broken[png.length - 20] ^= 0xff;
  await assert.rejects(build(dataFor([entry(1, 'Ana', broken)], [broken], sha('o'))), err => err.code === 'DRAWN_SIGNATURE_INVALID');
  await assert.rejects(buildFinalSignedPdf({ original: Buffer.from('no es un pdf'), data: dataFor(entries, [png], sha('o')), folio: null }), err => err.code === 'FINAL_PDF_ORIGIN_UNREADABLE');
 });
});

// ---------------------------------------------------------------- de extremo a extremo
describe('flujo completo con Storage por HTTP y las RPC de 07', () => {
 let db, server, supabase, storage, repository, service, signing;
 const objects = new Map(); // ruta -> { bytes, contentType }
 const uploads = [];
 let queue = Promise.resolve();
 const exclusive = fn => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };
 const sql = (text, params = []) => exclusive(async () => (await db.query(text, params)).rows);
 const asRole = (role, text, params = [], sub) => exclusive(async () => {
  if (sub) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
  await db.exec(`set role ${role}`);
  try { return (await db.query(text, params)).rows; } finally { await db.exec('reset role'); }
 });
 const callRpc = (name, args = {}) => {
  const keys = Object.keys(args);
  return asRole('service_role', `select public.${name}(${keys.map((k, i) => `${k}=>$${i + 1}`).join(',')}) r`, keys.map(k => args[k]));
 };
 const one = async (name, args) => (await callRpc(name, args))[0].r;

 // Cliente de la app: el Storage es el cliente real de Supabase; las RPC se ejecutan en PGlite con los nombres de parámetro reales.
 const client = () => ({
  storage: supabase.storage,
  rpc: async (name, args) => { try { return { data: await one(name, args), error: null }; } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; } },
  from: table => ({ select: () => ({ eq: (_c, value) => ({ maybeSingle: async () => ({ data: (await sql(`select folio from ${table} where id=$1`, [value]))[0] ?? null, error: null }) }) }) }),
 });

 function startStorage() {
  return new Promise(resolve => {
   server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const prefix = '/storage/v1/object/contract-documents/';
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(prefix.length));
    const reply = (status, payload, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(type === 'application/json' ? JSON.stringify(payload) : payload); };
    if (req.method === 'GET') {
     const object = objects.get(path);
     return object ? reply(200, object.bytes, object.contentType) : reply(400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    }
    uploads.push({ path, upsert: req.headers['x-upsert'], contentType: req.headers['content-type'] });
    if (req.headers['content-type'] !== 'application/pdf') return reply(400, { statusCode: '415', error: 'invalid_mime_type', message: 'mime type not supported' });
    if (body.length > 10485760) return reply(400, { statusCode: '413', error: 'Payload too large', message: 'too large' });
    if (objects.has(path) && req.headers['x-upsert'] !== 'true') return reply(400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
    objects.set(path, { bytes: body, contentType: req.headers['content-type'] });
    await sql(`insert into storage.objects(bucket_id,name,metadata) values('contract-documents',$1,$2::jsonb) on conflict(bucket_id,name) do update set metadata=excluded.metadata`, [path, JSON.stringify({ size: body.length, mimetype: req.headers['content-type'], eTag: `"${createHash('md5').update(body).digest('hex')}"` })]);
    return reply(200, { Id: randomUUID(), Key: `contract-documents/${path}` });
   });
   server.listen(0, '127.0.0.1', () => resolve(server.address().port));
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
  for (const [id, mail] of [[ids.rep, 'representante@example.com'], [ids.tenant, 'inquilino@example.com'], [ids.guarantor, 'fiador@example.com']]) await db.query('update personas set correo=$1 where id=$2', [mail, id]);
  supabase = createClient(`http://127.0.0.1:${await startStorage()}`, 'clave-de-prueba', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const app = client();
  storage = privatePdfStorage(app);
  repository = finalPdfRepository(app);
  service = createFinalPdfService(repository, storage);
  signing = createSigningService(signingRepository(app), service);
 });
 after(async () => { server.close(); await db.close(); });

 // ---------------------------------------------------------------- datos
 const text = value => { const t = value == null ? '' : String(value).trim().replace(/\s+/g, ' '); return /^(null|undefined)$/i.test(t) ? '' : t; };
 const fullName = p => (p ? [p.nombre, p.apellido_paterno, p.apellido_materno].map(text).filter(Boolean).join(' ') : '');
 const personContext = p => ({ nombre_completo: fullName(p), rfc: text(p?.rfc), curp: text(p?.curp) });
 const person = async id => (await sql('select * from personas where id=$1', [id]))[0];
 const parts = contractId => sql('select id,rol::text rol,persona_id,persona_moral_id from partes_contrato where contrato_id=$1 order by id', [contractId]);
 const principal = async company => (await sql('select * from representantes_persona_moral where persona_moral_id=$1 and es_principal order by id', [company]))[0];

 // Sube el PDF original real y abre el proceso: el hash que entra al proceso es el de esos bytes.
 async function pending({ original, guarantor = true } = {}) {
  const app = randomUUID();
  await sql("insert into solicitudes values($1,1,'aprobada')", [app]);
  await sql("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'solicitante')", [app, ids.tenant]);
  if (guarantor) await sql("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'fiador')", [app, ids.guarantor]);
  const contractId = (await asRole('authenticated', "select crear_contrato_desde_solicitud($1::uuid,'2026-11-01'::date,'2027-10-31'::date,12000::numeric,12000::numeric,1::integer,'PERSONA_MORAL'::text,$2::uuid) id", [app, ids.company], ids.admin))[0].id;
  const list = await parts(contractId);
  const company = (await sql('select * from personas_morales where id=$1', [ids.company]))[0];
  const rep = await principal(ids.company);
  const slot = async role => { const part = list.find(p => p.rol === role); return personContext(part ? await person(part.persona_id) : null); };
  const context = { arrendador: { tipo: 'PERSONA_MORAL', razon_social: text(company.razon_social), representante: personContext(await person(rep.persona_id)) }, arrendatario: await slot('ARRENDATARIO'), fiador: await slot('FIADOR') };
  const html = `<p>${context.arrendatario.nombre_completo}</p>`;
  const documentId = (await asRole('authenticated', `insert into documentos_contrato(contrato_id,version_plantilla_id,numero_version,tipo,estado,nombre_archivo,datos_snapshot,contenido_renderizado,generated_at)
   values($1,$2,1,'BORRADOR','GENERADO','CTR-prueba-v1.pdf',$3::jsonb,$4,now()) returning id`, [contractId, ids.v2, JSON.stringify(context), html], ids.admin))[0].id;
  const path = `${contractId}/${documentId}/CTR-prueba-v1.pdf`;
  await asRole('service_role', 'update documentos_contrato set storage_path=$2 where id=$1', [documentId, path]);
  const bytes = Buffer.from(original ?? await realPdf(2));
  objects.set(path, { bytes, contentType: 'application/pdf' });
  const pdfSha = sha256Hex(bytes);
  const fuentes = (await asRole('service_role', 'select firma_fuentes_para_verificar($1) f', [contractId]))[0].f;
  const identities = [];
  for (const part of list) {
   const base = { parte_contrato_id: part.id, rol: part.rol, referencia_documento: part.rol.toLowerCase() };
   if (part.persona_moral_id) identities.push({ ...base, entidad_tipo: 'PERSONA_MORAL', entidad_id: part.persona_moral_id, persona_firmante_id: rep.persona_id, representante_origen_id: rep.id });
   else identities.push({ ...base, entidad_tipo: 'PERSONA', entidad_id: part.persona_id, persona_firmante_id: part.persona_id, representante_origen_id: null });
  }
  const receipt = (await asRole('service_role', 'select registrar_validacion_documento_firma($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb) id',
   [ids.admin, contractId, documentId, pdfSha, bytes.length, JSON.stringify(fuentes), JSON.stringify(context), sha(html), sha(HTML_V2), 'renderer-prueba', JSON.stringify(identities)]))[0].id;
  const processId = (await asRole('authenticated', 'select iniciar_proceso_firma($1,$2,$3,$4) id', [contractId, documentId, pdfSha, receipt], ids.admin))[0].id;
  const signers = await sql('select id,rol from firmantes_proceso where proceso_firma_id=$1 order by rol', [processId]);
  return { contractId, documentId, processId, pdfSha, signers, originPath: path, finalPath: `${contractId}/firmas/${processId}/firmado.pdf` };
 }
 // Invitación, visualización, consentimiento y OTP: pasos reales de 07 con token y HMAC reales.
 async function ready(p, signerId, code = '123456') {
  const token = randomBytes(32).toString('base64url'), tokenHash = sha(token);
  const invitation = await one('emitir_invitacion_firma', { p_actor: ids.admin, p_proceso: p.processId, p_firmante: signerId, p_token_hash: tokenHash });
  await one('registrar_visualizacion_firma', { p_token_hash: tokenHash, p_sha256_calculado: sha256Hex((await storage.download(p.originPath))) });
  await one('registrar_consentimiento_firma', { p_token_hash: tokenHash, p_sha256_documento: p.pdfSha, p_version: 'CONSENTIMIENTO_FES_V2', p_acepta: true });
  const hmac = createHmac('sha256', SECRET).update(`${invitation.invitacion_id}:${code}`).digest('hex');
  await one('emitir_otp_firma', { p_token_hash: tokenHash, p_otp_hmac: hmac });
  return { tokenHash, otpHmac: hmac, invitationId: invitation.invitacion_id };
 }
 const submit = (p, inv, png, overrides = {}) => signing.submit({ processId: p.processId, tokenHash: inv.tokenHash, otpHmac: inv.otpHmac, documentSha256: p.pdfSha, pngBase64: Buffer.from(png).toString('base64'), confirmed: true, ...overrides });
 async function signAll(p, colors = [RED, GREEN, BLUE]) {
  let last;
  for (const [i, s] of p.signers.entries()) last = await submit(p, await ready(p, s.id), scribble(colors[i % colors.length]));
  return last;
 }
 // Firma todo sin que el servicio cierre: el cierre se prueba por separado.
 const directSign = async (p, colors = [RED, GREEN, BLUE]) => {
  const repo = signingRepository(client());
  for (const [i, s] of p.signers.entries()) {
   const inv = await ready(p, s.id); const png = scribble(colors[i % colors.length]);
   await repo.sign({ tokenHash: inv.tokenHash, otpHmac: inv.otpHmac, documentSha256: p.pdfSha, pngBase64: png.toString('base64'), pngSha256: sha256Hex(png), confirmed: true, ip: null, userAgent: null });
  }
 };
 const contractState = async id => (await sql('select estado::text e from contratos where id=$1', [id]))[0].e;
 const processRow = async id => (await sql('select * from procesos_firma where id=$1', [id]))[0];
 const adminRead = (p, options = {}) => handleFinalPdfReadRequest(new Request(`http://local/x${options.query ?? ''}`, { method: options.method ?? 'GET' }), options.contractId ?? p.contractId, p.processId,
  { authorize: async () => options.actor ?? ids.admin, service: () => service });

 // ---------------------------------------------------------------- caso válido
 const chromiumReady = existsSync(chromium.executablePath());
 test('PDF real de Chromium: tres firmas dibujadas, cierre automático y firmas visibles en el archivo de Storage', { skip: chromiumReady ? false : 'Chromium no instalado' }, async () => {
  const original = await generatePdfFromHtml(`<h1>Contrato de arrendamiento</h1>${'<p>Cláusula contractual. Arrendador y arrendatario aceptan los términos.</p>'.repeat(60)}`, { folio: 'CTR-CHROMIUM-1' });
  const before = await pdfText(original);
  assert.ok(before.count > 1);
  const p = await pending({ original });
  const colors = [RED, GREEN, BLUE];
  const results = [];
  for (const [i, s] of p.signers.entries()) {
   const inv = await ready(p, s.id);
   // Un lienzo vacío se rechaza en el servidor sin gastar intentos de OTP.
   await assert.rejects(submit(p, inv, canvas(600, 200, () => {})), err => err.code === 'DRAWN_SIGNATURE_EMPTY');
   assert.equal((await asRole('propietario_sim', 'select intentos from firma_privada.otps_firma where invitacion_id=$1', [inv.invitationId]))[0].intentos, 0, 'no gasta intentos');
   await assert.rejects(submit(p, inv, scribble(colors[i]), { confirmed: false }), err => err.code === 'SIGNATURE_NOT_CONFIRMED');
   results.push(await submit(p, inv, scribble(colors[i])));
  }
  assert.deepEqual(results.map(r => r.finalizacion), ['NO_REQUERIDA', 'NO_REQUERIDA', 'COMPLETADA']);
  assert.equal(await contractState(p.contractId), 'FIRMADO');
  const process = await processRow(p.processId);
  assert.equal(process.estado, 'COMPLETADO');

  // Lo guardado es lo verificado: el hash registrado es el de los bytes de Storage, no uno enviado por el cliente.
  const stored = objects.get(p.finalPath);
  assert.equal(process.sha256_documento_firmado, sha256Hex(stored.bytes));
  assert.equal(results[2].sha256PdfFinal, sha256Hex(stored.bytes));
  const objectRow = (await sql('select metadata from storage.objects where name=$1', [p.finalPath]))[0];
  assert.equal(objectRow.metadata.size, stored.bytes.length);
  assert.equal(uploads.find(u => u.path === p.finalPath).upsert, 'false');

  const after = await pdfText(stored.bytes);
  assert.equal(after.count, before.count + 1);
  for (let n = 0; n < before.count; n++) assert.equal(after.pages[n], before.pages[n], `página ${n + 1} intacta`);
  const data = (await one('consultar_evidencia_firma', { p_actor: ids.admin, p_proceso: p.processId }));
  assert.equal(data.pdf_final.sha256, process.sha256_documento_firmado);
  const sheet = after.pages.at(-1);
  assert.ok(sheet.includes(p.pdfSha));
  assert.ok(sheet.includes(data.pdf_final.sha256_manifiesto));
  for (const firma of data.firmas) { assert.ok(sheet.includes(firma.sha256_firma)); assert.ok(sheet.includes(firma.sha256_evidencia)); assert.ok(sheet.includes(firma.nombre_firmante)); }
  for (const color of colors) {
   assert.ok(await countColor(after.pdf, after.count, color) > 300, `firma ${color} visible en la constancia`);
   assert.equal(await countColor(after.pdf, 1, color), 0);
  }
  const manifest = JSON.parse(Buffer.from((await after.pdf.getAttachments())[FINAL_PDF_MANIFEST_NAME].content).toString());
  assert.deepEqual(manifest.firmas, data.pdf_final.manifiesto);

  // Consulta y descarga verificadas.
  for (const [query, disposition] of [['', 'inline'], ['?descargar=1', 'attachment']]) {
   const response = await adminRead(p, { query });
   assert.equal(response.status, 200);
   assert.equal(response.headers.get('x-content-sha256'), process.sha256_documento_firmado);
   assert.ok(response.headers.get('content-disposition').startsWith(disposition));
   assert.equal(response.headers.get('cache-control'), 'no-store');
   assert.equal(sha256Hex(new Uint8Array(await response.arrayBuffer())), process.sha256_documento_firmado);
  }
 });

 test('una firma incorrecta o previa a la última no genera PDF ni cambia el contrato', async () => {
  const p = await pending({ guarantor: false });
  const [first, second] = p.signers;
  assert.equal((await submit(p, await ready(p, first.id), scribble())).finalizacion, 'NO_REQUERIDA');
  assert.equal(objects.has(p.finalPath), false);
  const last = await ready(p, second.id);
  const wrong = await submit(p, last, scribble(), { otpHmac: sha('otro código') });
  assert.deepEqual([wrong.resultado, wrong.finalizacion], ['OTP_INCORRECTO', 'NO_REQUERIDA']);
  assert.equal(objects.has(p.finalPath), false);
  assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
  assert.equal((await submit(p, last, scribble())).finalizacion, 'COMPLETADA');
  assert.equal(await contractState(p.contractId), 'FIRMADO');
 });

 // ---------------------------------------------------------------- PDF original
 test('original alterado en Storage: no genera nada, la firma queda y la recuperación cierra al restaurarlo', async () => {
  const p = await pending({ guarantor: false });
  const good = objects.get(p.originPath);
  await directSign(p);
  objects.set(p.originPath, { ...good, bytes: Buffer.from(await realPdf(2, 'Documento sustituido')) });
  await assert.rejects(service.finalize(p.processId), err => err.code === 'FINAL_PDF_ORIGIN_MISMATCH');
  assert.equal(objects.has(p.finalPath), false);
  assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
  assert.ok((await repository.pendingProcesses(500)).includes(p.processId));
  objects.set(p.originPath, good);
  await service.finalize(p.processId);
  assert.equal(await contractState(p.contractId), 'FIRMADO');
 });

 test('si el cierre falla tras la última firma, el firmante no pierde su firma y la recuperación termina', async () => {
  const p = await pending({ guarantor: false });
  const good = objects.get(p.originPath);
  await submit(p, await ready(p, p.signers[0].id), scribble(RED));
  const last = await ready(p, p.signers[1].id);
  objects.delete(p.originPath);
  const result = await submit(p, last, scribble(GREEN));
  assert.deepEqual([result.resultado, result.finalizacion], ['FIRMADO', 'PENDIENTE']);
  assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
  objects.set(p.originPath, good);
  const recovered = await service.recover(50);
  assert.ok(recovered.completados >= 1);
  assert.equal(await contractState(p.contractId), 'FIRMADO');
  const final = await pdfText(objects.get(p.finalPath).bytes);
  assert.ok(await countColor(final.pdf, final.count, RED) > 300);
  assert.ok(await countColor(final.pdf, final.count, GREEN) > 300);
 });

 // ---------------------------------------------------------------- reintentos y carreras
 test('caída entre la subida y el registro: la recuperación registra el mismo objeto, sin sobrescribirlo', async () => {
  const p = await pending({ guarantor: false });
  await directSign(p);
  const crashing = createFinalPdfService({ ...repository, register: async () => { throw new Error('caída simulada'); } }, storage);
  await assert.rejects(crashing.finalize(p.processId), /caída simulada/);
  const uploaded = objects.get(p.finalPath).bytes;
  assert.equal(await contractState(p.contractId), 'PENDIENTE_FIRMA');
  await service.recover(50);
  assert.equal(await contractState(p.contractId), 'FIRMADO');
  assert.ok(objects.get(p.finalPath).bytes.equals(uploaded), 'no se sobrescribió');
  assert.equal((await processRow(p.processId)).sha256_documento_firmado, sha256Hex(uploaded));
  assert.ok(uploads.filter(u => u.path === p.finalPath).every(u => u.upsert === 'false'));
 });

 test('dos finalizaciones simultáneas: un solo PDF, un solo registro y ambas terminan bien', async () => {
  const p = await pending({ guarantor: false });
  await directSign(p);
  const [a, b] = await Promise.all([service.finalize(p.processId), service.finalize(p.processId)]);
  assert.equal(a.sha256, b.sha256);
  assert.equal(a.pdfFinalId, b.pdfFinalId);
  assert.deepEqual([a.yaRegistrado, b.yaRegistrado].sort(), [false, true]);
  assert.equal((await processRow(p.processId)).sha256_documento_firmado, sha256Hex(objects.get(p.finalPath).bytes));
  await assert.rejects(service.finalize(p.processId), err => err.code === 'PROCESS_NOT_PENDING');
 });

 test('un archivo ajeno en la ruta final no se registra ni se sobrescribe', async () => {
  const p = await pending({ guarantor: false });
  await directSign(p);
  const foreign = Buffer.from(await realPdf(1, 'Archivo ajeno'));
  await supabase.storage.from('contract-documents').upload(p.finalPath, foreign, { contentType: 'application/pdf', upsert: false });
  await assert.rejects(service.finalize(p.processId), err => err.code === 'FINAL_PDF_CONFLICT');
  assert.ok(objects.get(p.finalPath).bytes.equals(foreign));
  assert.deepEqual([(await processRow(p.processId)).estado, await contractState(p.contractId)], ['PENDIENTE', 'PENDIENTE_FIRMA']);
  // Otro archivo que no es PDF.
  const q = await pending({ guarantor: false });
  await directSign(q);
  await supabase.storage.from('contract-documents').upload(q.finalPath, Buffer.from('no es un pdf'), { contentType: 'application/pdf', upsert: false });
  await assert.rejects(service.finalize(q.processId), err => err.code === 'FINAL_PDF_CONFLICT');
  // Otro proceso anulado para que la recuperación de las siguientes pruebas no los reintente.
  for (const r of [p, q]) await asRole('authenticated', 'select anular_proceso_firma($1,$2,$3)', [r.processId, 'Archivo ajeno en la prueba', 'CANCELADO'], ids.admin);
 });

 test('un PDF final por encima del límite no se sube', async () => {
  // Original justo por debajo del límite: lo que añaden las firmas lo hace pasar.
  let original, size = 10485760;
  do {
   const doc = await PDFDocument.create();
   doc.addPage([612, 792]);
   await doc.attach(randomBytes(size), 'relleno.bin', { mimeType: 'application/octet-stream' });
   original = await doc.save();
   size -= Math.max(original.length - 10485760 + 300, 0);
  } while (original.length > 10485760);
  const p = await pending({ original, guarantor: false });
  await directSign(p);
  await assert.rejects(service.finalize(p.processId), err => err.code === 'FINAL_PDF_TOO_LARGE');
  assert.equal(objects.has(p.finalPath), false);
  await asRole('authenticated', 'select anular_proceso_firma($1,$2,$3)', [p.processId, 'PDF por encima del límite', 'CANCELADO'], ids.admin);
 });

 // ---------------------------------------------------------------- recuperación
 test('recuperación: un proceso fallido no detiene a los demás, y el endpoint exige el secreto', async () => {
  const broken = await pending({ guarantor: false }), fine = await pending({ guarantor: false });
  await directSign(broken); await directSign(fine);
  const good = objects.get(broken.originPath);
  objects.set(broken.originPath, { ...good, bytes: Buffer.from(await realPdf(1, 'Alterado')) });
  const call = (headers, secret = 'secreto-cron', method = 'GET') => handleFinalPdfRecoveryRequest(new Request('http://local/x', { method, headers }), { secret, service: () => ({ recover: () => service.recover(50) }) });
  assert.equal((await call({})).status, 401);
  assert.equal((await call({ authorization: 'Bearer otro' })).status, 401);
  assert.equal((await call({ authorization: 'Bearer secreto-cron' }, null)).status, 500, 'sin secreto configurado no atiende');
  assert.equal((await call({ authorization: 'Bearer secreto-cron' }, 'secreto-cron', 'DELETE')).status, 405);
  assert.equal(await contractState(fine.contractId), 'PENDIENTE_FIRMA', 'los rechazos no ejecutan nada');
  const response = await call({ authorization: 'Bearer secreto-cron' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.completados >= 1);
  assert.deepEqual(body.fallidos.filter(f => f.procesoId === broken.processId), [{ procesoId: broken.processId, code: 'FINAL_PDF_ORIGIN_MISMATCH' }]);
  assert.equal(await contractState(fine.contractId), 'FIRMADO');
  assert.equal(await contractState(broken.contractId), 'PENDIENTE_FIRMA');
  objects.set(broken.originPath, good);
  assert.ok((await service.recover(50)).completados >= 1);
  assert.equal(await contractState(broken.contractId), 'FIRMADO');
  const again = await service.recover(50);
  assert.deepEqual([again.pendientes, again.completados, again.fallidos], [0, 0, []]);
 });

 // ---------------------------------------------------------------- lectura verificada
 test('lectura verificada: un archivo sustituido no se entrega; solo un administrador y solo de su contrato', async () => {
  const p = await pending({ guarantor: false });
  await signAll(p);
  const genuine = objects.get(p.finalPath);
  assert.equal((await adminRead(p)).status, 200);
  // Mismo tamaño, otros bytes: solo el hash real lo detecta.
  const altered = Buffer.from(genuine.bytes); altered[altered.length - 200] ^= 0xff;
  objects.set(p.finalPath, { ...genuine, bytes: altered });
  const rejected = await adminRead(p);
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error.code, 'FINAL_PDF_TAMPERED');
  objects.set(p.finalPath, { ...genuine, bytes: Buffer.from(await realPdf(1)) });
  assert.equal((await adminRead(p)).status, 409);
  objects.delete(p.finalPath);
  assert.equal((await adminRead(p)).status, 500);
  objects.set(p.finalPath, genuine);
  assert.equal((await adminRead(p)).status, 200);
  assert.equal((await adminRead(p, { contractId: randomUUID() })).status, 404);
  assert.equal((await adminRead(p, { actor: ids.user })).status, 403);
  assert.equal((await adminRead(p, { method: 'POST' })).status, 405);
  const unauthorized = await handleFinalPdfReadRequest(new Request('http://local/x'), p.contractId, p.processId, { authorize: async () => { throw new PdfError(401, 'UNAUTHENTICATED', 'Inicia sesión'); }, service: () => { throw new Error('no debe construirse'); } });
  assert.equal(unauthorized.status, 401);
  const open2 = await pending({ guarantor: false });
  assert.equal((await adminRead(open2)).status, 404, 'proceso sin PDF final');
  await asRole('authenticated', 'select cancelar_proceso_firma($1,$2)', [open2.processId, 'Limpieza de la prueba'], ids.admin);
 });

 test('la imagen guardada es la validada y la del PDF es la guardada', async () => {
  const p = await pending({ guarantor: false });
  const png = scribble(BLUE);
  await submit(p, await ready(p, p.signers[0].id), png);
  const stored = (await asRole('propietario_sim', 'select firma_png,sha256_firma from firma_privada.firmas_electronicas where proceso_firma_id=$1', [p.processId]))[0];
  assert.ok(Buffer.from(stored.firma_png).equals(png));
  assert.equal(stored.sha256_firma, sha256Hex(png));
  await submit(p, await ready(p, p.signers[1].id), scribble(RED));
  const pdf = await open(objects.get(p.finalPath).bytes);
  assert.ok(await countColor(pdf, pdf.numPages, BLUE) > 300);
 });
});

