import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
// Pantallas del firmante con React real en jsdom: red, visor de PDF y lienzo simulados. El lienzo y el visor reales se prueban en Chromium (firmas-2c-firmante.test.mjs).
const TOKEN = 'A'.repeat(43);
const dom = new JSDOM('<div id="root"></div>', { url: `https://app.test/firmar#t=${TOKEN}` });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const moduleSource = source => ({ url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true });
registerHooks({ resolve(specifier, context, next) {
 if (specifier === 'react') return next(specifier, { ...context, parentURL: import.meta.url });
 if (specifier === './PdfViewer') return moduleSource('import {createElement,useEffect} from "react";export function PdfViewer({onRendered,onFailed,onReachedEnd}){useEffect(()=>{if(!globalThis[Symbol.for("firmas.visorSinDibujar")])onRendered()},[]);return createElement("div",{"data-testid":"visor"},createElement("button",{onClick:onReachedEnd},"llegar al final"),createElement("button",{onClick:onFailed},"simular fallo"))}');
 if (specifier === './pdfRenderer') return moduleSource('export const renderPdfPages=(...args)=>globalThis[Symbol.for("firmas.render")](...args);');
 if (specifier === './SignaturePad') return moduleSource('import {createElement} from "react";export function SignaturePad({onChange}){return createElement("button",{onClick:()=>onChange("UE5H")},"dibujar")}');
 if (specifier.startsWith('@/modules/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
 if (specifier.startsWith('@/components/ui/')) return moduleSource('import {createElement} from "react";export const Button=({asChild,variant,size,children,...props})=>createElement("button",props,children);');
 if (specifier.startsWith('.') && context.parentURL?.includes('/firmas/') && !/\.tsx?$/.test(specifier)) {
  for (const ext of ['.ts', '.tsx']) { const url = new URL(specifier + ext, context.parentURL); try { readFileSync(url); return next(url.href, context); } catch {} }
 }
 return next(specifier, context);
}, load(url, context, next) {
 if (url.endsWith('.tsx')) return { format: 'module', source: transformSync(readFileSync(new URL(url), 'utf8'), { loader: 'tsx', jsx: 'automatic', format: 'esm' }).code, shortCircuit: true };
 return next(url, context);
} });
const { PdfViewer: RealPdfViewer } = await import('../src/modules/admin/arrendamiento/contratos/firmas/publica/PdfViewer.tsx');
const { default: SigningPage } = await import('../src/modules/admin/arrendamiento/contratos/firmas/publica/SigningPage.tsx');
const { readInvitationToken } = await import('../src/modules/admin/arrendamiento/contratos/firmas/publica/signer.client.ts');

const SIGNED = { resultado: 'FIRMADO', firmadoAt: '2026-11-03T18:00:00Z', sha256Documento: 'd'.repeat(64), sha256Firma: 'f'.repeat(64), sha256Evidencia: 'e'.repeat(64), firmantesPendientes: 1, finalizacion: 'NO_REQUERIDA' };
const bytes = new TextEncoder().encode('%PDF-prueba');
const digest = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const SESSION = { folio: 'CTR-2026-000001', nombreFirmante: 'Ana Ruiz', nombreEntidad: 'Empresa SA', rol: 'ARRENDADOR', caracter: 'REPRESENTANTE_LEGAL', correoParcial: 'an***@example.com', expiraAt: '2026-11-05T18:00:00Z',
 sha256Documento: digest, consentimientoVersion: 'CONSENTIMIENTO_FES_V2', consentimientoTexto: 'Yo, Ana Ruiz, manifiesto:\n\n1. Firma electrónica.  Con dos espacios.', visualizado: false, consentido: false, otpExpiraAt: null, codigoDisponible: true };
const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fail = (status, code, message) => new Response(JSON.stringify({ error: { code, message }, requestId: 'r' }), { status, headers: { 'Content-Type': 'application/json' } });
const invalid = () => fail(404, 'INVITATION_INVALID', 'La invitación no es válida, venció o ya se utilizó.');
let root, requests, routes;
const body = init => (init?.body ? JSON.parse(init.body) : undefined);
beforeEach(() => {
 requests = [];
 routes = {
  sesion: () => ok(SESSION), documento: () => new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/pdf' } }), consentimiento: () => ok({ consentido: true }),
  codigo: () => ok({ expiraAt: '2026-11-03T18:10:00Z', codigosRestantes: 4 }), firmar: () => ok(SIGNED),
 };
 globalThis.fetch = async (url, init) => { requests.push({ url, init }); return routes[url.split('/').pop()](init); };
 root = createRoot(document.getElementById('root'));
});
afterEach(async () => { await act(async () => root.unmount()); });
const settle = () => act(async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 2)); });
const start = async () => { await act(async () => root.render(createElement(SigningPage))); await settle(); };
const text = () => document.getElementById('root').textContent;
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent === label);
async function click(label) { const b = button(label); assert.ok(b, label); assert.equal(b.disabled, false, `${label} activo`); await act(async () => b.click()); await settle(); }
async function check(name) { const input = document.querySelector(`input[name="${name}"]`); await act(async () => input.click()); }
async function typeCode(value) {
 const input = document.querySelector('input[name="codigo"]');
 await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
}
const calls = name => requests.filter(r => r.url === `/api/firma/${name}`);
const toDraw = async () => { await start(); await click('llegar al final'); await check('acepta'); await click('Aceptar y continuar'); };
const toCode = async () => { await toDraw(); await click('dibujar'); await click('Continuar'); };
const toCodeEntered = async () => { await toCode(); await click('Generar código'); await typeCode('123456'); await check('confirmacion'); };

test('el token se lee del fragmento y viaja solo en la cabecera, sin cookies', async () => {
 assert.equal(readInvitationToken('#t=abc'), 'abc'); assert.equal(readInvitationToken(''), null);
 await start();
 assert.equal(requests[0].url, '/api/firma/sesion');
 assert.equal(requests[0].init.headers.Authorization, `Bearer ${TOKEN}`);
 assert.equal(requests[0].init.credentials, 'omit');
 for (const request of requests) assert.ok(!request.url.includes(TOKEN));
});

test('enlace inválido: mensaje que no distingue la causa, sin datos del contrato', async () => {
 routes.sesion = invalid;
 await start();
 assert.match(text(), /Este enlace ya no está disponible/);
 assert.equal(calls('documento').length, 0);
});

test('un fallo temporal al abrir permite reintentar', async () => {
 routes.sesion = () => fail(500, 'UNEXPECTED', 'No se pudo completar la operación.');
 await start();
 assert.equal(document.querySelector('[role=alert]').textContent, 'No se pudo completar la operación.');
 routes.sesion = () => ok(SESSION);
 await click('Reintentar');
 assert.match(text(), /Paso 1 de 3/);
});

test('paso 1: muestra documento, huella y el texto exacto del servidor; sin aceptar no avanza', async () => {
 await start();
 assert.ok(document.querySelector('[data-testid=visor]'));
 assert.equal(document.querySelector('[data-testid=consent-text]').textContent, SESSION.consentimientoTexto);
 assert.ok(text().includes(digest)); assert.match(text(), /Ana Ruiz/); assert.match(text(), /CTR-2026-000001/); assert.match(text(), /en representación de Empresa SA/);
 assert.equal(button('Aceptar y continuar').disabled, true);
 assert.equal(document.querySelector('input[name=acepta]').disabled, true, 'la casilla espera al final del PDF');
 assert.match(text(), /Desplázate hasta el final del documento/);
 await click('llegar al final');
 assert.doesNotMatch(text(), /Desplázate hasta el final/);
 assert.equal(document.querySelector('input[name=acepta]').disabled, false);
 assert.equal(button('Aceptar y continuar').disabled, true, 'falta marcar la casilla');
 assert.match(text(), /He leído el documento y este consentimiento, y los acepto\./);
 await check('acepta');
 await click('Aceptar y continuar');
 assert.deepEqual(body(calls('consentimiento')[0].init), { sha256Documento: digest, version: 'CONSENTIMIENTO_FES_V2', acepta: true });
 assert.match(text(), /Paso 2 de 3/);
});

test('encabezado: cada valor del catálogo con su etiqueta, sin códigos, y OTRO sin carácter', async () => {
 for (const [caracter, heading] of [['REPRESENTANTE_LEGAL', '(Arrendador, Representante legal)'], ['APODERADO_LEGAL', '(Arrendador, Apoderado legal)'], ['ADMINISTRADOR', '(Arrendador, Administrador)'], ['OTRO', '(Arrendador)']]) {
  routes.sesion = () => ok({ ...SESSION, caracter });
  await start();
  assert.ok(text().includes(heading), caracter);
  for (const code of ['REPRESENTANTE_LEGAL', 'APODERADO_LEGAL', 'ADMINISTRADOR', 'OTRO']) assert.ok(!text().includes(code), `${caracter}: aparece ${code}`);
  assert.doesNotMatch(text(), /, \)|\(, |\botro\b|\bOtro\b/, caracter);
  await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
 }
 routes.sesion = () => ok({ ...SESSION, rol: 'ARRENDATARIO', caracter: 'POR_DERECHO_PROPIO', nombreEntidad: SESSION.nombreFirmante });
 await start();
 assert.ok(text().includes('(Arrendatario, Por derecho propio)'));
});

test('el texto se muestra sin alterar: mismos párrafos y espacios, con estilo que los respeta', async () => {
 await start();
 const element = document.querySelector('[data-testid=consent-text]');
 assert.equal(element.textContent, SESSION.consentimientoTexto);
 assert.match(element.className, /whitespace-pre-wrap/);
});

test('un documento que no coincide con la huella no se muestra ni deja aceptar', async () => {
 routes.documento = () => new Response(new TextEncoder().encode('otro'), { status: 200 });
 await start();
 assert.equal(document.querySelector('[data-testid=visor]'), null);
 assert.match(document.querySelector('[role=alert]').textContent, /no coincide/);
 assert.equal(document.querySelector('input[name=acepta]').disabled, true);
 assert.equal(button('Aceptar y continuar').disabled, true);
 routes.documento = () => new Response(bytes, { status: 200 });
 await click('Volver a cargar el documento');
 assert.ok(document.querySelector('[data-testid=visor]'));
});

test('quien ya aceptó ve el documento y continúa sin volver a registrar', async () => {
 routes.sesion = () => ok({ ...SESSION, consentido: true, visualizado: true });
 await start();
 assert.match(text(), /Ya aceptaste este texto/);
 await click('Continuar');
 assert.equal(calls('consentimiento').length, 0);
 assert.match(text(), /Paso 2 de 3/);
});

test('quien ya aceptó no puede continuar mientras el documento no se muestre', async () => {
 routes.sesion = () => ok({ ...SESSION, consentido: true, visualizado: true });
 globalThis[Symbol.for('firmas.visorSinDibujar')] = true;
 try {
  await start();
  assert.equal(button('Continuar').disabled, true);
  assert.doesNotMatch(text(), /Desplázate hasta el final/);
 } finally { delete globalThis[Symbol.for('firmas.visorSinDibujar')]; }
});

test('si el PDF no se puede mostrar, no hay aviso de desplazamiento ni forma de aceptar', async () => {
 globalThis[Symbol.for('firmas.visorSinDibujar')] = true;
 try {
  await start();
  assert.doesNotMatch(text(), /Desplázate hasta el final/);
  await click('simular fallo');
  assert.equal(document.querySelector('input[name=acepta]').disabled, true);
  assert.equal(button('Aceptar y continuar').disabled, true);
 } finally { delete globalThis[Symbol.for('firmas.visorSinDibujar')]; }
});

test('paso 2: sin trazo no avanza; se puede volver al documento', async () => {
 await toDraw();
 assert.equal(button('Continuar').disabled, true);
 await click('Volver al documento');
 assert.match(text(), /Paso 1 de 3/);
});

test('paso 3: el código se pide a propósito, sin afirmar que se envió un correo; exige 6 dígitos y confirmar; envía lo esperado', async () => {
 await toCode();
 assert.equal(calls('codigo').length, 0, 'no se envía solo');
 assert.match(text(), /no se envía ningún correo/);
 assert.doesNotMatch(text(), /[Ee]nviamos|Revisa tu correo|de tu correo/);
 assert.equal(document.querySelector('img').getAttribute('src'), 'data:image/png;base64,UE5H');
 await click('Generar código');
 assert.match(text(), /Código generado/); assert.match(text(), /Puedes pedir 4 más/);
 assert.doesNotMatch(text(), /[Ee]nviamos|Revisa tu correo/);
 assert.equal(button('Firmar documento').disabled, true);
 await typeCode('12a3');
 assert.equal(document.querySelector('input[name=codigo]').value, '123', 'solo dígitos');
 await typeCode('123456');
 assert.equal(button('Firmar documento').disabled, true, 'falta confirmar');
 assert.equal(document.querySelector('input[name=codigo]').inputMode, 'numeric');
 assert.equal(document.querySelector('input[name=codigo]').autocomplete, 'one-time-code');
 await check('confirmacion');
 await click('Firmar documento');
 assert.deepEqual(body(calls('firmar')[0].init), { codigo: '123456', sha256Documento: digest, firmaPng: 'UE5H', confirmacion: true });
 assert.match(text(), /Tu firma quedó registrada/);
 assert.ok(text().includes('f'.repeat(64))); assert.ok(text().includes('e'.repeat(64)));
});

test('reenvío: bloqueado con cuenta regresiva, y al reabrir con un código vigente lo indica', async () => {
 await toCode();
 await click('Generar código');
 const resend = [...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Pedir otro código'));
 assert.equal(resend.disabled, true); assert.match(resend.textContent, /\(60 s\)/);
 await act(async () => root.unmount());
 root = createRoot(document.getElementById('root'));
 routes.sesion = () => ok({ ...SESSION, consentido: true, otpExpiraAt: '2026-11-03T18:10:00Z' });
 await start();
 await click('Continuar'); await click('dibujar'); await click('Continuar');
 assert.match(text(), /Ya se generó un código/);
 assert.equal(button('Pedir otro código').disabled, false);
 routes.codigo = () => fail(429, 'OTP_TOO_SOON', 'Espera un minuto antes de pedir otro código.');
 await click('Pedir otro código');
 assert.equal(document.querySelector('[role=alert]').textContent, 'Espera un minuto antes de pedir otro código.');
 assert.match([...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Pedir otro código')).textContent, /\(60 s\)/);
});

test('cada resultado de un código fallido se explica y limpia el campo', async () => {
 await toCodeEntered();
 for (const [resultado, intentosRestantes, message] of [['OTP_INCORRECTO', 3, /Te quedan 3 intentos/], ['OTP_VENCIDO', 0, /venció/], ['OTP_AGOTADO', 0, /agotaron/], ['OTP_INEXISTENTE', 0, /ya no es válido/]]) {
  routes.firmar = () => ok({ resultado, intentosRestantes });
  await typeCode('123456');
  await click('Firmar documento');
  assert.match(document.querySelector('[role=alert]').textContent, message, resultado);
  assert.equal(document.querySelector('input[name=codigo]').value, '');
 }
 assert.doesNotMatch(text(), /Tu firma quedó registrada/);
});

test('los textos concuerdan con la cantidad: un intento y el último código', async () => {
 routes.codigo = () => ok({ expiraAt: '2026-11-03T18:10:00Z', codigosRestantes: 0 });
 await toCodeEntered();
 assert.match(text(), /Es el último código de este enlace/);
 assert.doesNotMatch(text(), /\.\./);
 routes.firmar = () => ok({ resultado: 'OTP_INCORRECTO', intentosRestantes: 1 });
 await click('Firmar documento');
 assert.equal(document.querySelector('[role=alert]').textContent, 'El código no es correcto. Te queda 1 intento.');
});

test('un límite de códigos se muestra al firmante', async () => {
 routes.codigo = () => fail(429, 'OTP_LIMIT_REACHED', 'Ya no se pueden generar más códigos con este enlace.');
 await toCode();
 await click('Generar código');
 assert.match(document.querySelector('[role=alert]').textContent, /Ya no se pueden generar más códigos/);
});

test('sin canal de códigos se avisa desde el documento y no se ofrece generar uno', async () => {
 routes.sesion = () => ok({ ...SESSION, codigoDisponible: false });
 await toCode();
 assert.match(document.querySelector('[role=alert]').textContent, /no está disponible en este entorno/);
 assert.doesNotMatch(text(), /no se envía ningún correo/);
 assert.equal(button('Generar código'), undefined);
 assert.equal(calls('codigo').length, 0);
});

test('un dibujo rechazado devuelve al lienzo con el motivo, y el código enviado se conserva', async () => {
 await toCodeEntered();
 routes.firmar = () => fail(422, 'DRAWN_SIGNATURE_EMPTY', 'Dibuja tu firma completa.');
 await click('Firmar documento');
 assert.match(text(), /Paso 2 de 3/);
 assert.equal(document.querySelector('[role=alert]').textContent, 'Dibuja tu firma completa.');
 assert.equal(button('Continuar').disabled, true, 'el dibujo anterior se descartó');
 routes.firmar = () => ok(SIGNED);
 await click('dibujar'); await click('Continuar');
 assert.equal(calls('codigo').length, 1, 'no se pide otro código');
 assert.match(text(), /Ya se generó un código/);
});

test('si la invitación vence en cualquier paso, se muestra el aviso de enlace no disponible', async () => {
 routes.consentimiento = invalid;
 await toDraw();
 assert.match(text(), /Este enlace ya no está disponible/);
 await act(async () => root.unmount());
 root = createRoot(document.getElementById('root'));
 routes.consentimiento = () => ok({ consentido: true });
 routes.firmar = invalid;
 await toCodeEntered();
 await click('Firmar documento');
 assert.match(text(), /Este enlace ya no está disponible/);
});

test('sin conexión: mensaje claro y se puede volver a intentar', async () => {
 await toCodeEntered();
 routes.firmar = () => { throw new TypeError('Failed to fetch'); };
 await click('Firmar documento');
 assert.match(document.querySelector('[role=alert]').textContent, /No hay conexión/);
 routes.firmar = () => ok(SIGNED);
 await click('Firmar documento');
 assert.match(text(), /Tu firma quedó registrada/);
});

test('el resultado describe el estado real del proceso según el servidor', async () => {
 for (const [finalizacion, firmantesPendientes, message] of [['COMPLETADA', 0, /Todas las partes firmaron y el contrato quedó firmado/], ['PENDIENTE', 0, /El documento final se está generando/], ['NO_REQUERIDA', 2, /Faltan 2 firmas de otras partes/]]) {
  routes.firmar = () => ok({ ...SIGNED, finalizacion, firmantesPendientes });
  await toCodeEntered();
  await click('Firmar documento');
  assert.match(text(), message);
  await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
 }
});

// ---------------------------------------------------------------- visor real, con el dibujo del PDF controlado
async function mountViewer() {
 const control = { calls: 0 };
 globalThis[Symbol.for('firmas.render')] = () => new Promise((resolve, reject) => Object.assign(control, { resolve, reject }));
 await act(async () => root.render(createElement(RealPdfViewer, { bytes, onRendered: () => control.rendered = true, onFailed: () => control.failed = true, onReachedEnd: () => control.calls++ })));
 const box = document.querySelector('[data-testid=pdf-pages]');
 const metrics = values => { for (const [name, value] of Object.entries(values)) Object.defineProperty(box, name, { value, configurable: true, writable: true }); };
 const scrollTo = async top => { metrics({ scrollTop: top }); await act(async () => box.dispatchEvent(new window.Event('scroll', { bubbles: true }))); };
 const finish = async () => { await act(async () => { control.resolve(); }); await settle(); };
 return { control, metrics, scrollTo, finish, link: () => document.querySelector('a[download]') };
}

test('visor: se habilita solo al llegar al final con todo dibujado', async () => {
 const v = await mountViewer();
 v.metrics({ scrollHeight: 3000, clientHeight: 500, scrollTop: 0 });
 await v.scrollTo(2500);
 assert.equal(v.control.calls, 0, 'mientras dibuja, el final visible no cuenta');
 await v.scrollTo(0);
 await v.finish();
 assert.equal(v.control.calls, 0, 'al terminar de dibujar sigue arriba');
 await v.scrollTo(1500);
 assert.equal(v.control.calls, 0, 'a la mitad no cuenta');
 await v.scrollTo(2480);
 assert.equal(v.control.calls, 0, 'cerca, pero no al final, no cuenta');
 await v.scrollTo(2495);
 assert.equal(v.control.calls, 1);
});

test('visor: un documento que cabe sin desplazarse cuenta como visto al terminar de dibujar', async () => {
 const v = await mountViewer();
 v.metrics({ scrollHeight: 400, clientHeight: 400, scrollTop: 0 });
 assert.equal(v.control.calls, 0);
 await v.finish();
 assert.equal(v.control.calls, 1);
});

test('visor: descargar nunca habilita, ni con el PDF en pantalla ni cuando el navegador no puede mostrarlo', async () => {
 const v = await mountViewer();
 v.metrics({ scrollHeight: 3000, clientHeight: 500, scrollTop: 0 });
 await v.finish();
 await act(async () => v.link().dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })));
 assert.equal(v.control.calls, 0, 'con el PDF en pantalla, descargar no habilita');
 await act(async () => root.unmount());
 root = createRoot(document.getElementById('root'));
 const failed = await mountViewer();
 await act(async () => { failed.control.reject(new Error('sin soporte')); });
 await settle();
 assert.match(document.querySelector('[role=alert]').textContent, /no pudo mostrar el documento.*navegador compatible.*Descargar el PDF no habilita/);
 assert.equal(failed.control.failed, true); assert.equal(failed.control.rendered, undefined);
 await act(async () => failed.link().dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })));
 assert.equal(failed.control.calls, 0, 'descargar no habilita');
 assert.equal(failed.control.rendered, undefined);
});

test('una doble pulsación no envía la firma dos veces', async () => {
 await toCodeEntered();
 let release;
 routes.firmar = () => new Promise(resolve => { release = () => resolve(ok(SIGNED)); });
 const sign = button('Firmar documento');
 await act(async () => { sign.click(); sign.click(); });
 await settle();
 assert.equal(calls('firmar').length, 1);
 await act(async () => release());
 await settle();
 assert.match(text(), /Tu firma quedó registrada/);
});
