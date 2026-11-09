import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
// Interfaz de firma con React real en jsdom; red y Supabase simulados. Jamás Supabase real.
const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.test/admin/arrendamiento/contratos/c' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const state = globalThis[Symbol.for('firmas.ui')] = { process: null, documents: [], queries: 0, documentLoads: 0, tables: {}, writes: 0 };
const moduleSource = source => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
 if (specifier === 'react') return next(specifier, { ...context, parentURL: import.meta.url });
 // Cliente Supabase del navegador: cadena de consulta que devuelve el proceso simulado.
 if (specifier === '@/lib/supabaseClient') return moduleSource('const s=globalThis[Symbol.for("firmas.ui")];export const supabase={from(t){if(t==="procesos_firma")s.table=t;const rows=()=>s.tables[t];const q={select(){return q},eq(){return q},not(){return q},order(){return q},limit(){return q},returns(){return q},update(){s.writes++;return q},insert(){s.writes++;return q},then(ok){return Promise.resolve(s.tables.fail===t?{data:null,error:{message:"x"}}:{data:rows()??[],error:null}).then(ok)},maybeSingle:async()=>{s.queries++;return rows()?{data:rows()[0]??null,error:null}:{data:s.process,error:s.error??null}}};return q}};');
 if (specifier === '../hooks/useContractDocuments') return moduleSource('import {useState,useEffect} from "react";const s=globalThis[Symbol.for("firmas.ui")];export function useContractDocuments(){const [n,set]=useState(0);useEffect(()=>{s.documentLoads++},[n]);return {data:s.documents,loading:false,error:null,reload:()=>set(v=>v+1)}}');
 if (specifier === '../../components/ContractShared') return moduleSource('export const contractPath=id=>"/c/"+id;export function ContractQueryError(){return null}');
 if (specifier === './PdfActions') return moduleSource('export function PdfActions(){return null}');
 if (specifier.startsWith('@/modules/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
 if (specifier.startsWith('@/components/ui/')) return moduleSource('import {createElement} from "react";const make=tag=>({asChild,variant,size,children,...props})=>asChild?children:createElement(tag,props,children);export const Button=make("button"),Badge=make("span"),Table=make("table"),TableBody=make("tbody"),TableCell=make("td"),TableHead=make("th"),TableHeader=make("thead"),TableRow=make("tr");');
 if (specifier.startsWith('.') && context.parentURL?.includes('/contratos/') && !/\.tsx?$/.test(specifier)) {
  for (const ext of ['.ts', '.tsx']) { const url = new URL(specifier + ext, context.parentURL); try { readFileSync(url); return next(url.href, context); } catch {} }
 }
 return next(specifier, context);
}, load(url, context, next) {
 if (url.endsWith('.tsx')) return { format: 'module', source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'tsx', jsx: 'automatic', format: 'esm' }).code, shortCircuit: true };
 return next(url, context);
} });
const base = '../src/modules/admin/arrendamiento/contratos/';
const { SignatureProcessPanel } = await import(`${base}firmas/components/SignatureProcessPanel.tsx`);
const { default: ContractDocuments } = await import(`${base}documentos/components/ContractDocuments.tsx`);

const C = '11111111-1111-4111-8111-111111111111', P = '33333333-3333-4333-8333-333333333333', D = '22222222-2222-4222-8222-222222222222';
const pending = () => ({ id: P, contrato_id: C, documento_origen_id: D, estado: 'PENDIENTE', iniciado_at: '2026-10-29T18:00:00Z', cancelado_at: null, motivo_cancelacion: null,
 documento: { numero_version: 3, nombre_archivo: 'CTR-2026-000001-v3.pdf' },
 firmantes: [{ id: 'f2', rol: 'FIADOR', nombre_entidad: 'Luis Pérez', caracter: 'POR_DERECHO_PROPIO', estado: 'PENDIENTE', firmado_at: null },
  { id: 'f1', rol: 'ARRENDADOR', nombre_entidad: 'Empresa SA de CV', caracter: 'REPRESENTANTE_LEGAL', estado: 'PENDIENTE', firmado_at: null }] });
let root, requests, invitationStates;
const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// La consulta de invitaciones (GET) tiene su propia respuesta; respond solo fija la de las acciones POST.
const respond = (status, body) => { globalThis.fetch = async (url, init) => {
 if (!init?.method) return typeof invitationStates === 'function' ? invitationStates() : jsonResponse(200, { invitaciones: invitationStates });
 requests.push({ url, init }); return jsonResponse(status, body);
}; };
beforeEach(() => { requests = []; invitationStates = []; respond(500, {}); Object.assign(state, { process: null, error: null, documents: [], queries: 0, documentLoads: 0, tables: {}, writes: 0 }); root = createRoot(document.getElementById('root')); });
afterEach(async () => { await act(async () => root.unmount()); });
const render = async element => act(async () => root.render(element));
const text = () => document.getElementById('root').textContent;
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent === label);
async function click(label) { const b = button(label); assert.ok(b, label); await act(async () => b.click()); }
async function type(value) {
 const input = document.querySelector('[name="motivo_cancelacion"]');
 await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
}

test('sin procesos no muestra el panel; consulta procesos_firma del contrato', async () => {
 await render(createElement(SignatureProcessPanel, { contractId: C }));
 assert.equal(state.table, 'procesos_firma'); assert.equal(text(), '');
});

test('proceso pendiente: estado, documento y firmantes; cancelar exige motivo y refresca panel y ficha', async () => {
 state.process = pending(); let changed = 0;
 await render(createElement(SignatureProcessPanel, { contractId: C, onChanged: () => changed++ }));
 assert.match(text(), /Estado del proceso:PENDIENTE/); assert.match(text(), /Documento v3 \(CTR-2026-000001-v3\.pdf\)/);
 assert.deepEqual([...document.querySelectorAll('li')].map(li => li.textContent), ['ARRENDADOR: Empresa SA de CV (REPRESENTANTE LEGAL) — PENDIENTEGenerar enlace', 'FIADOR: Luis Pérez (POR DERECHO PROPIO) — PENDIENTEGenerar enlace']);
 await click('Cancelar proceso de firma');
 assert.equal(button('Confirmar cancelación').disabled, true);
 await type('   '); assert.equal(button('Confirmar cancelación').disabled, true);
 await type('  Datos del fiador erróneos '); assert.equal(button('Confirmar cancelación').disabled, false);
 respond(200, { procesoId: P, estado: 'CANCELADO' });
 state.process = { ...pending(), estado: 'CANCELADO', cancelado_at: '2026-10-29T19:00:00Z', motivo_cancelacion: 'Datos del fiador erróneos' };
 const queriesBefore = state.queries;
 await click('Confirmar cancelación');
 assert.equal(requests.length, 1);
 assert.equal(requests[0].url, `/api/admin/arrendamiento/contratos/${C}/firmas/${P}/cancelar`);
 assert.equal(requests[0].init.method, 'POST'); assert.deepEqual(JSON.parse(requests[0].init.body), { motivo: 'Datos del fiador erróneos' });
 assert.equal(changed, 1); assert.ok(state.queries > queriesBefore);
 assert.match(text(), /Estado del proceso:CANCELADO/); assert.match(text(), /Motivo: Datos del fiador erróneos/);
 assert.equal(button('Cancelar proceso de firma'), undefined);
});

test('error del servidor al cancelar: mensaje visible, sin refrescar la ficha y reintento posible', async () => {
 state.process = pending(); let changed = 0;
 await render(createElement(SignatureProcessPanel, { contractId: C, onChanged: () => changed++ }));
 await click('Cancelar proceso de firma'); await type('Motivo');
 respond(409, { error: { code: 'SIGNATURE_REJECTED', message: 'Proceso con firmas/evidencias requiere resolución posterior explícita' } });
 await click('Confirmar cancelación');
 assert.equal(document.querySelector('[role="alert"]').textContent, 'Proceso con firmas/evidencias requiere resolución posterior explícita');
 assert.equal(changed, 0); assert.equal(button('Confirmar cancelación').disabled, false);
});

test('error al consultar el proceso: alerta y reintento', async () => {
 state.error = { code: 'PGRST301', message: 'JWT expired' };
 await render(createElement(SignatureProcessPanel, { contractId: C }));
 assert.match(document.querySelector('[role="alert"]').textContent, /No se pudo consultar el proceso de firma/);
 state.error = null; state.process = pending();
 await click('Reintentar');
 assert.match(text(), /Estado del proceso:PENDIENTE/);
});

const LINK = 'https://sitio.test/firmar#t=' + 'a'.repeat(43);
const linkInput = () => document.querySelector('input[name=enlace_firma]');

test('invitación: botón solo para firmantes pendientes; muestra y copia el enlace, sin afirmar que se envió un correo', async () => {
 state.process = pending();
 state.process.firmantes[0].estado = 'FIRMADO';
 await render(createElement(SignatureProcessPanel, { contractId: C }));
 const buttons = () => [...document.querySelectorAll('button')].filter(b => /enlace/i.test(b.textContent));
 assert.equal(buttons().length, 1, 'el firmante que ya firmó no tiene botón');
 assert.equal(linkInput(), null);
 respond(200, { enlace: LINK, expiraAt: '2026-11-05T18:00:00Z' });
 invitationStates = [{ firmanteId: 'f1', estado: 'VIGENTE', emitidaAt: '2026-11-02T18:00:00Z', expiraAt: '2026-11-05T18:00:00Z' }];
 await click('Generar enlace');
 assert.equal(requests[0].url, `/api/admin/arrendamiento/contratos/${C}/firmas/${P}/invitaciones`);
 assert.deepEqual(JSON.parse(requests[0].init.body), { firmanteId: 'f1' });
 assert.equal(linkInput().value, LINK);
 assert.match(text(), /Invitación vigente/); assert.match(text(), /No se envió ningún correo/);
 assert.doesNotMatch(text(), /Enviada a|[Rr]eenviar/);
 const copied = [];
 Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied.push(value); } } });
 await click('Copiar enlace');
 assert.deepEqual(copied, [LINK]); assert.match(text(), /Enlace copiado/);
 Object.defineProperty(globalThis.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denegado'); } } });
 await click('Copiar enlace');
 assert.match(document.querySelector('[role=alert]').textContent, /cópialo a mano/);
 delete globalThis.navigator.clipboard;
 await render(null);
 state.process = { ...pending(), estado: 'CANCELADO', cancelado_at: '2026-10-30T18:00:00Z', motivo_cancelacion: 'x' };
 await render(createElement(SignatureProcessPanel, { contractId: C, key: 'otro' }));
 assert.equal(buttons().length, 0, 'un proceso cerrado no invita');
});

test('invitación vigente sin enlace en memoria: explica que no se puede volver a mostrar y reemplazarla exige confirmar', async () => {
 state.process = pending();
 invitationStates = [{ firmanteId: 'f1', estado: 'VIGENTE', emitidaAt: '2026-11-02T18:00:00Z', expiraAt: '2026-11-05T18:00:00Z' }];
 await render(createElement(SignatureProcessPanel, { contractId: C }));
 assert.equal(linkInput(), null);
 assert.match(text(), /El enlace solo se muestra al generarlo/);
 respond(409, { error: { message: 'El firmante no tiene un correo válido en el proceso.' } });
 await click('Generar enlace nuevo');
 assert.equal(requests.length, 0, 'no se revoca sin confirmar');
 assert.match(text(), /El enlace anterior dejará de funcionar/);
 await click('Confirmar enlace nuevo');
 assert.equal(requests.length, 1);
 assert.equal(document.querySelector('[role=alert]').textContent, 'El firmante no tiene un correo válido en el proceso.');
 respond(200, { enlace: LINK, expiraAt: '2026-11-05T18:00:00Z' });
 await click('Confirmar enlace nuevo');
 assert.equal(linkInput().value, LINK);
});

test('actualizar estado conserva los enlaces generados y refleja las firmas', async () => {
 state.process = pending(); let changed = 0;
 await render(createElement(SignatureProcessPanel, { contractId: C, onChanged: () => changed++ }));
 respond(200, { enlace: LINK, expiraAt: '2026-11-05T18:00:00Z' });
 await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Generar enlace').click());
 assert.equal(linkInput().value, LINK);
 state.process = pending();
 state.process.firmantes.find(s => s.id === 'f2').estado = 'FIRMADO';
 await click('Actualizar estado');
 assert.equal(linkInput()?.value, LINK, 'el enlace de quien falta sigue visible');
 assert.equal(document.querySelectorAll('input[name=enlace_firma]').length, 1);
 assert.equal(changed, 0, 'sin cambio de estado no recarga la ficha');
});

test('un fallo al consultar invitaciones se muestra sin ocultar el proceso', async () => {
 state.process = pending();
 invitationStates = () => jsonResponse(500, { error: { message: 'No se pudo consultar.' } });
 await render(createElement(SignatureProcessPanel, { contractId: C }));
 assert.equal(document.querySelector('[role=alert]').textContent, 'No se pudo consultar.');
 assert.match(text(), /Estado del proceso:PENDIENTE/);
});

test('PDF final: enlaces solo al completarse; si todos firmaron y falta, lo indica; al completarse recarga la ficha', async () => {
 state.process = pending();
 for (const signer of state.process.firmantes) signer.estado = 'FIRMADO';
 let changed = 0;
 await render(createElement(SignatureProcessPanel, { contractId: C, onChanged: () => changed++ }));
 assert.match(text(), /el PDF final aún no está registrado/);
 assert.equal(document.querySelector('a[href*="pdf-final"]'), null);
 state.process = { ...state.process, estado: 'COMPLETADO' };
 await click('Actualizar estado');
 const urls = [...document.querySelectorAll('a[href*="pdf-final"]')].map(link => link.getAttribute('href'));
 const url = `/api/admin/arrendamiento/contratos/${C}/firmas/${P}/pdf-final`;
 assert.deepEqual(urls, [url, `${url}?descargar=1`]);
 assert.equal(changed, 1);
 assert.equal(button('Actualizar estado'), undefined);
});

// ---------------------------------------------------------------- revisión de representación antes de iniciar
const COMPANY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const representation = (caracter, overrides = {}) => ({ partes_contrato: [{ rol: 'ARRENDADOR', persona_moral_id: COMPANY }], configuracion_sistema: [{ valor: COMPANY }], personas_morales: [{ razon_social: 'Empresa SA de CV' }],
 representantes_persona_moral: [{ id: 'r', caracter, persona: { nombre: 'Manuel', apellido_paterno: 'Pérez', apellido_materno: null } }], ...overrides });
const startDoc = () => ({ id: D, contrato_id: C, version_plantilla_id: 'v', numero_version: 1, tipo: 'BORRADOR', estado: 'GENERADO', nombre_archivo: 'a.pdf', storage_path: `${C}/${D}/a.pdf`, generated_at: null, created_at: null });
async function openStart() {
 state.documents = [startDoc()];
 await render(createElement(ContractDocuments, { contractId: C, contractStatus: 'BORRADOR' }));
 await click('Iniciar firma');
 await act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 1)); });
}
const list = () => document.querySelector('[aria-label="Datos de representación"]');
const settingsLink = () => [...document.querySelectorAll('a')].find(a => a.getAttribute('href') === '/admin/configuracion/arrendador');

test('antes de iniciar: cada carácter con redacción propia se muestra como lo verá el firmante, sin avisos ni correcciones', async () => {
 for (const [caracter, phrase] of [['REPRESENTANTE_LEGAL', 'representante legal'], ['APODERADO_LEGAL', 'apoderado legal'], ['ADMINISTRADOR', 'administrador']]) {
  state.tables = representation(caracter);
  await openStart();
  assert.match(list().textContent, /Empresa SA de CV · Representante: Manuel Pérez/);
  assert.ok(list().textContent.includes(`«en mi carácter de ${phrase} de Empresa SA de CV, como parte arrendadora»`), caracter);
  assert.ok(!list().textContent.includes(caracter), 'sin el código interno');
  assert.equal(Boolean(settingsLink()), false);
  assert.equal(button('Confirmar inicio de firma').disabled, false);
  assert.equal(state.writes, 0, 'no modifica registros');
  await render(null);
 }
});

test('antes de iniciar: OTRO avisa que no se indicará un carácter y enlaza a la corrección, sin bloquear ni modificar', async () => {
 state.tables = representation('OTRO');
 await openStart();
 assert.match(list().textContent, /«en representación de Empresa SA de CV, como parte arrendadora»/);
 assert.match(list().textContent, /no indicará un carácter específico/);
 assert.ok(!list().textContent.includes('OTRO'), 'sin el código interno');
 assert.ok(settingsLink(), 'enlaza a Datos del arrendador');
 assert.match(list().textContent, /genera una revisión nueva del documento/);
 assert.equal(button('Confirmar inicio de firma').disabled, false, 'el administrador decide');
 assert.equal(state.writes, 0);
});

test('antes de iniciar: datos que el servidor rechazaría bloquean el inicio y se pueden ir a corregir', async () => {
 for (const tables of [representation(null), representation('Apoderado General'), representation('OTRO', { representantes_persona_moral: [] }),
  representation('OTRO', { representantes_persona_moral: [{ caracter: 'OTRO' }, { caracter: 'OTRO' }] })]) {
  state.tables = tables;
  await openStart();
  assert.equal(button('Confirmar inicio de firma').disabled, true);
  assert.ok(list().querySelector('[role=alert]'));
  assert.ok(settingsLink());
  await render(null);
 }
});

test('antes de iniciar: otra persona moral no ofrece un enlace que no la corregiría; sin persona moral no hay revisión', async () => {
 state.tables = representation('OTRO', { configuracion_sistema: [{ valor: 'otra' }] });
 await openStart();
 assert.equal(Boolean(settingsLink()), false);
 assert.match(list().textContent, /no es el arrendador configurado/);
 await render(null);
 state.tables = { partes_contrato: [] };
 await openStart();
 assert.equal(Boolean(list()), false);
 assert.equal(button('Confirmar inicio de firma').disabled, false);
});

test('antes de iniciar: si no se pueden consultar los datos, no se confirma hasta volver a consultar', async () => {
 state.tables = { ...representation('REPRESENTANTE_LEGAL'), fail: 'partes_contrato' };
 await openStart();
 assert.match(document.querySelector('[role=alert]').textContent, /No se pudieron consultar los datos de representación/);
 assert.equal(button('Confirmar inicio de firma').disabled, true);
 state.tables = representation('REPRESENTANTE_LEGAL');
 await click('Volver a consultar');
 await act(async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 1)); });
 assert.equal(button('Confirmar inicio de firma').disabled, false);
});

test('documentos: "Iniciar firma" solo en elegibles; al iniciar refresca documentos y ficha', async () => {
 const doc = (id, change = {}) => ({ id, contrato_id: C, version_plantilla_id: 'v', numero_version: 1, tipo: 'BORRADOR', estado: 'GENERADO', nombre_archivo: 'a.pdf', storage_path: `${C}/${id}/a.pdf`, generated_at: null, created_at: '', updated_at: '', ...change });
 state.documents = [doc(D), doc('sin-pdf', { storage_path: null }), doc('anulado', { estado: 'ANULADO' })]; let started = 0;
 await render(createElement(ContractDocuments, { contractId: C, contractStatus: 'BORRADOR', onSignatureStarted: () => started++ }));
 assert.equal([...document.querySelectorAll('button')].filter(b => b.textContent === 'Iniciar firma').length, 1);
 await click('Iniciar firma');
 respond(200, { procesoId: P });
 const loadsBefore = state.documentLoads;
 await click('Confirmar inicio de firma');
 assert.equal(requests[0].url, `/api/admin/arrendamiento/contratos/${C}/documentos/${D}/firma`); assert.equal(requests[0].init.body, undefined);
 assert.equal(started, 1); assert.ok(state.documentLoads > loadsBefore);
 await render(createElement(ContractDocuments, { contractId: C, contractStatus: 'PENDIENTE_FIRMA' }));
 assert.equal(button('Iniciar firma'), undefined);
});

test('error al iniciar: mensaje del servidor sin refrescar la ficha', async () => {
 state.documents = [{ id: D, contrato_id: C, version_plantilla_id: 'v', numero_version: 1, tipo: 'BORRADOR', estado: 'GENERADO', nombre_archivo: 'a.pdf', storage_path: 'x', generated_at: null, created_at: '', updated_at: '' }];
 let started = 0;
 await render(createElement(ContractDocuments, { contractId: C, contractStatus: 'BORRADOR', onSignatureStarted: () => started++ }));
 await click('Iniciar firma');
 respond(409, { error: { code: 'DOCUMENT_OUTDATED', message: 'Los datos del contrato cambiaron desde que se generó este documento.' } });
 await click('Confirmar inicio de firma');
 assert.match(document.querySelector('[role="alert"]').textContent, /cambiaron desde que se generó/); assert.equal(started, 0);
});
