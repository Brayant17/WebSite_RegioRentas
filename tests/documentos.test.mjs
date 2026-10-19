import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";

const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const calls = [];
let responses = new Map();
globalThis[Symbol.for("documentos.test.supabase")] = {
  from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    function response() {
      const queue = responses.get(table);
      assert.ok(queue?.length, `Consulta inesperada a ${table}`);
      const next = queue.shift();
      return typeof next === "function" ? next(call) : Promise.resolve(next);
    }
    const query = {
      select(columns) { call.select = columns; return query; },
      eq(key, value) { call.filters.push([key, value]); return query; },
      order(key, options) { call.order = [key, options]; return query; },
      limit(value) { call.limit = value; return query; },
      insert(payload) { call.insert = structuredClone(payload); return query; },
      maybeSingle: response, single: response, returns: response,
    };
    return query;
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabaseClient") return {
      url: `data:text/javascript,${encodeURIComponent('export const supabase = globalThis[Symbol.for("documentos.test.supabase")];')}`, shortCircuit: true,
    };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (context.parentURL?.includes("/src/modules/admin/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const service = await import("../src/modules/admin/arrendamiento/contratos/documentos/services/documentos.service.ts");
const repository = await import("../src/modules/admin/arrendamiento/contratos/documentos/repositories/documentos.repository.ts");
const { useDocumentGeneration } = await import("../src/modules/admin/arrendamiento/contratos/documentos/hooks/useDocumentGeneration.ts");
const { useHistoricalDocument } = await import("../src/modules/admin/arrendamiento/contratos/documentos/hooks/useContractDocuments.ts");
const { buildContractTemplateContext } = await import("../src/modules/admin/arrendamiento/contratos/plantillas/services/context.service.ts");
const { renderContractTemplate } = await import("../src/modules/admin/arrendamiento/contratos/plantillas/renderer.ts");
const { importantEmptyFields } = await import("../src/modules/admin/arrendamiento/contratos/plantillas/utils/contextWarnings.ts");
const ok = data => ({ data, error: null });
const inserts = () => calls.filter(call => call.insert);

function source(rent = "12000.00") {
  const person = { id: "persona", nombre: 'Ana <Pérez> & "Familia"', apellido_paterno: null, apellido_materno: null, rfc: null, curp: null, domicilio_origen: null, telefono: null, correo: null };
  return {
    contract: { id: "contrato", estado: "BORRADOR", arrendador_persona_moral_id: "empresa", folio: "CTR-2026-000001", fecha_inicio: "2026-10-01", fecha_fin: "2027-09-30", renta: rent, deposito: "12000.00", dia_pago: 1, fecha_firma: null, lugar_firma: null,
      partes: [{ id: "parte", rol: "ARRENDATARIO", persona_id: person.id, persona_moral_id: null, persona: person }, { id: "arrendador", rol: "ARRENDADOR", persona_id: null, persona_moral_id: "empresa", persona: null }],
      unidad: { nombre: "Local", numero: 1, tipo: "Local", piso: 0, ubicacion: null, edificio: { nombre: "Edificio", direccion: "Calle 1", ciudad: "Monterrey", estado: "Nuevo León", codigo_postal: "64000" } } },
    landlord: { id: "empresa", razon_social: "Empresa", nombre_comercial: null, rfc: null, domicilio: null, ciudad: null, estado: null, codigo_postal: null, telefono: null, correo: null, estatus: "ACTIVA" },
    representatives: [{ id: "representante", caracter: "REPRESENTANTE_LEGAL", persona: person }],
  };
}

function queueGeneration({ data = source(), html = "<p>{{contrato.renta}} {{arrendatario.nombre_completo}}</p>", last = null, inserted } = {}) {
  responses.set("contratos", [ok(data.contract)]);
  responses.set("personas_morales", [ok(data.landlord)]);
  responses.set("representantes_persona_moral", [ok(data.representatives)]);
  responses.set("versiones_plantilla", [ok({ id: "version-seleccionada", plantilla_id: "plantilla", numero_version: 17, estado: "BORRADOR", plantilla: { id: "plantilla", nombre: "Contrato" }, contenido: html })]);
  responses.set("documentos_contrato", [ok(last === null ? null : { numero_version: last }), inserted ?? (call => ok({ ...call.insert, id: "documento", generated_at: "2026-09-21T12:00:00Z", created_at: "2026-09-21T12:00:00Z", updated_at: "2026-09-21T12:00:00Z" }))]);
}
beforeEach(() => { calls.length = 0; responses = new Map(); });

test("siguiente revisión es max + 1 por contrato, incluyendo estados anteriores", async () => {
  responses.set("documentos_contrato", [ok(null), ok({ numero_version: 7 })]);
  assert.equal(await repository.getNextDocumentVersion("contrato"), 1);
  assert.equal(await repository.getNextDocumentVersion("contrato"), 8);
  for (const call of calls) {
    assert.deepEqual(call.filters, [["contrato_id", "contrato"]]);
    assert.deepEqual(call.order, ["numero_version", { ascending: false }]);
    assert.equal(call.limit, 1);
  }
});
test("nombre determinista sin rutas, caracteres peligrosos ni nombres reservados", () => {
  assert.equal(service.documentFilename("CTR-2026-000001", 1), "CTR-2026-000001-v1.pdf");
  for (const folio of ["../../etc/passwd", "C:\\windows\\..\\CON", "../", "CON", "áé / ? * < > | :", "x".repeat(1000)]) {
    const name = service.documentFilename(folio, 2);
    assert.match(name, /^[A-Za-z0-9_-]+-v2\.pdf$/);
    assert.ok(name.length <= 107);
  }
  assert.throws(() => service.documentFilename("CTR", 0));
});
test("generación guarda el mismo contexto y HTML, y distingue revisión de versión de plantilla", async () => {
  const data = source();
  const html = "<p>{{contrato.renta}} {{arrendatario.nombre_completo}}</p>";
  queueGeneration({ data, html, last: 2 });
  const result = await service.generateContractDocument("contrato", "version-seleccionada");
  const context = buildContractTemplateContext(data);
  const saved = inserts()[0].insert;
  assert.deepEqual(saved.datos_snapshot, context);
  assert.equal(saved.contenido_renderizado, renderContractTemplate(html, context).html);
  assert.equal(saved.datos_snapshot.arrendatario.nombre_completo, 'Ana <Pérez> & "Familia"');
  assert.match(saved.contenido_renderizado, /&lt;Pérez&gt;/);
  assert.equal(saved.numero_version, 3);
  assert.equal(saved.version_plantilla_id, "version-seleccionada");
  assert.equal(saved.tipo, "BORRADOR"); assert.equal(saved.estado, "GENERADO");
  assert.equal(saved.storage_path, null); assert.equal(saved.generated_at, "now");
  assert.equal(result.document.numero_version, 3);
  assert.equal(inserts().length, 1);
  assert.equal(inserts()[0].table, "documentos_contrato");
});
test("campos importantes vacíos advierten pero no bloquean ni se consideran desconocidos", async () => {
  queueGeneration({ html: "<p>{{contrato.fecha_firma}} {{contrato.renta}}</p>" });
  const result = await service.generateContractDocument("contrato", "version-seleccionada");
  assert.ok(result.emptyFields.some(field => field.variable === "contrato.fecha_firma"));
  assert.ok(result.emptyFields.some(field => field.variable === "contrato.lugar_firma"));
  assert.equal(inserts().length, 1);
  const context = buildContractTemplateContext(source());
  context.arrendador.razon_social = ""; context.arrendador.representante.nombre_completo = "";
  context.arrendatario.nombre_completo = ""; context.inmueble.direccion_completa = "";
  context.contrato.renta = ""; context.contrato.fecha_inicio = ""; context.contrato.fecha_fin = "";
  assert.equal(importantEmptyFields(context).length, 9);
});
test("variables desconocidas bloquean incluso el cálculo de revisión y el INSERT", async () => {
  queueGeneration({ html: "<p>{{contrato.no_existe}}</p>" });
  await assert.rejects(service.generateContractDocument("contrato", "version-seleccionada"), /variables desconocidas/);
  assert.equal(calls.some(call => call.table === "documentos_contrato"), false);
});
test("HTML vacío en plantilla o tras renderizar bloquea INSERT", async () => {
  for (const html of ["   ", "{{contrato.fecha_firma}}", "{{contrato.lugar_firma}}\n"]) {
    queueGeneration({ html });
    await assert.rejects(service.generateContractDocument("contrato", "version-seleccionada"), /HTML/);
  }
  assert.equal(inserts().length, 0);
});
test("contrato no BORRADOR o inexistente bloquea generación", async () => {
  const data = source(); data.contract.estado = "ACTIVO";
  queueGeneration({ data });
  await assert.rejects(service.generateContractDocument("contrato", "version-seleccionada"), /BORRADOR/);
  queueGeneration(); responses.set("contratos", [ok(null)]);
  await assert.rejects(service.generateContractDocument("contrato", "version-seleccionada"), /No se encontró el contrato/);
  assert.equal(inserts().length, 0);
});
test("mantiene ID elegido y rechaza una versión inexistente sin elegir otra", async () => {
  queueGeneration(); responses.set("versiones_plantilla", [ok(null)]);
  await assert.rejects(service.generateContractDocument("contrato", "version-seleccionada"), /versión BORRADOR/);
  const versions = calls.filter(call => call.table === "versiones_plantilla");
  assert.equal(versions.length, 1);
  assert.ok(versions[0].filters.some(([key, value]) => key === "id" && value === "version-seleccionada"));
  assert.equal(inserts().length, 0);
});
test("listado ordena revisión descendente sin descargar HTML ni snapshot", async () => {
  responses.set("documentos_contrato", [ok([])]);
  assert.deepEqual(await service.listContractDocuments("contrato"), []);
  assert.deepEqual(calls[0].order, ["numero_version", { ascending: false }]);
  assert.deepEqual(calls[0].filters, [["contrato_id", "contrato"]]);
  assert.equal(calls[0].select.includes("contenido_renderizado"), false);
  assert.equal(calls[0].select.includes("datos_snapshot"), false);
});
test("histórico valida pertenencia por filtro y por resultado", async () => {
  responses.set("documentos_contrato", [ok({ id: "documento", contrato_id: "otro", contenido_renderizado: "HTML" })]);
  await assert.rejects(service.loadHistoricalDocument("contrato", "documento"), /no pertenece/);
  assert.deepEqual(calls[0].filters, [["id", "documento"], ["contrato_id", "contrato"]]);
});
test("documento legado sin HTML muestra error y no reconstruye contenido", async () => {
  responses.set("documentos_contrato", [ok({ id: "documento", contrato_id: "contrato", contenido_renderizado: null })]);
  await assert.rejects(service.loadHistoricalDocument("contrato", "documento"), /no tiene contenido HTML histórico/);
  assert.equal(calls.length, 1);
});
test("colisión unique y permisos generan errores entendibles sin reintento automático", async () => {
  queueGeneration({ inserted: { data: null, error: { code: "23505" } } });
  await assert.rejects(service.generateContractDocument("contrato", "version-seleccionada"), error => {
    assert.match(service.documentErrorMessage(error), /misma revisión/); return true;
  });
  assert.equal(inserts().length, 1);
  assert.match(service.documentErrorMessage({ code: "42501" }), /SELECT e INSERT.*documentos_contrato/);
  assert.match(service.documentErrorMessage(new TypeError("Failed to fetch")), /antes de volver a generar/);
});
test("snapshot histórico conserva renta A aunque contexto actual B cambie, también al visualizar", async () => {
  let stored;
  queueGeneration({ inserted: call => {
    stored = structuredClone({ ...call.insert, id: "documento", generated_at: "2026-09-21T12:00:00Z" });
    return ok(stored);
  } });
  await service.generateContractDocument("contrato", "version-seleccionada");
  assert.equal(stored.datos_snapshot.contrato.renta, "$12,000.00");
  const currentB = buildContractTemplateContext(source("13000.00"));
  assert.equal(currentB.contrato.renta, "$13,000.00");
  calls.length = 0;
  // No respuestas para contratos/personas/plantillas: cualquier reconstrucción fallaría la prueba.
  responses = new Map([["documentos_contrato", [ok(stored), ok(stored)]]]);
  const historical = await service.loadHistoricalDocument("contrato", "documento");
  assert.equal(historical.datos_snapshot.contrato.renta, "$12,000.00");
  assert.ok(historical.contenido_renderizado.includes("$12,000.00"));
  assert.equal(historical.contenido_renderizado.includes("$13,000.00"), false);
  let state;
  function HistoryHarness() { state = useHistoricalDocument("contrato", "documento"); return createElement("span"); }
  const root = createRoot(document.getElementById("root"));
  await act(async () => { root.render(createElement(HistoryHarness)); });
  assert.equal(state.error, null);
  assert.ok(state.data.iframeDocument.includes("$12,000.00"));
  assert.equal(state.data.iframeDocument.includes("$13,000.00"), false);
  assert.deepEqual(calls.map(call => call.table), ["documentos_contrato", "documentos_contrato"]);
  await act(async () => { root.unmount(); });
});
test("hook de UI bloquea doble generación simultánea y expone estado guardando", async () => {
  let release;
  queueGeneration({ inserted: call => new Promise(resolve => { release = () => resolve(ok({ ...call.insert, id: "documento" })); }) });
  let state;
  function Harness() { state = useDocumentGeneration("contrato"); return createElement("button", { disabled: state.saving }, "Generar"); }
  const root = createRoot(document.getElementById("root"));
  await act(async () => { root.render(createElement(Harness)); });
  let first;
  await act(async () => {
    first = state.generate("version-seleccionada");
    assert.equal(await state.generate("version-seleccionada"), undefined);
  });
  assert.equal(state.saving, true);
  assert.equal(document.querySelector("button").disabled, true);
  assert.equal(inserts().length, 1);
  await act(async () => { release(); await first; });
  assert.equal(state.saving, false);
  assert.equal(state.result.document.id, "documento");
  assert.equal(inserts().length, 1);
  await act(async () => { root.unmount(); });
});


test("2B.2: snapshot nuevo congela cuatro valores y lectura histórica no reconstruye", async () => {
  let stored;
  const data=source();Object.assign(data.contract,{costo_lavanderia:"100.25",domicilio_arrendador:"A",domicilio_arrendatario:"B",domicilio_fiador:"C"});
  queueGeneration({data,html:"<p>{{contrato.costo_lavanderia}}|{{contrato.domicilio_arrendador}}|{{contrato.domicilio_arrendatario}}|{{contrato.domicilio_fiador}}</p>",inserted:call=>{stored=structuredClone({...call.insert,id:"documento"});return ok(stored);}});
  await service.generateContractDocument("contrato","version-seleccionada");
  assert.equal(stored.datos_snapshot.valores_contractuales.costo_lavanderia,100.25);
  assert.equal(stored.contenido_renderizado,"<p>$100.25|A|B|C</p>");
  const frozen=structuredClone(stored);
  Object.assign(data.contract,{costo_lavanderia:200,domicilio_arrendador:"D",domicilio_arrendatario:"E",domicilio_fiador:null});
  const current=buildContractTemplateContext(data);assert.equal(current.contrato.costo_lavanderia,"$200.00");
  calls.length=0;responses=new Map([["documentos_contrato",[ok(stored)]]]);
  assert.deepEqual(await service.loadHistoricalDocument("contrato","documento"),frozen);
  assert.deepEqual(calls.map(call=>call.table),["documentos_contrato"]);
  // Snapshot legado: no añadir claves faltantes, ni reconstruir HTML guardado.
  const legacy=structuredClone(stored);delete legacy.datos_snapshot.valores_contractuales;
  for(const key of ["costo_lavanderia","domicilio_arrendador","domicilio_arrendatario","domicilio_fiador"]) delete legacy.datos_snapshot.contrato[key];
  legacy.contenido_renderizado="<p>HTML histórico intacto</p>";
  const legacyFrozen=JSON.stringify(legacy);responses=new Map([["documentos_contrato",[ok(legacy)]]]);
  assert.equal(JSON.stringify(await service.loadHistoricalDocument("contrato","documento")),legacyFrozen);
});

test("nueva generación guarda bloques resueltos y no reconstruye el histórico", async () => {
  const data = source();
  queueGeneration({ data, html: '<p>{{arrendador.bloques.comparecencia}}</p>{{arrendador.bloques.antecedentes_identidad}}<div>{{arrendador.bloques.firma}}</div>' });
  const result = await service.generateContractDocument('contrato', 'version-seleccionada');
  const saved = structuredClone(inserts()[0].insert);
  assert.equal(saved.datos_snapshot.arrendador.bloques.tipo, 'PERSONA_MORAL');
  assert.equal(saved.datos_snapshot.arrendador.bloques.revision, 'arrendador-v2-moral-maquetacion-1');
  for (const name of ['comparecencia', 'antecedentes_identidad', 'firma']) {
    assert.ok(saved.datos_snapshot.arrendador.bloques[name]);
    assert.ok(saved.contenido_renderizado.includes(saved.datos_snapshot.arrendador.bloques[name]));
  }
  data.landlord.razon_social = 'Otra empresa';
  responses.set('documentos_contrato', [ok({ ...saved, id: 'documento' })]);
  calls.length = 0;
  const historical = await service.loadHistoricalDocument('contrato', 'documento');
  assert.deepEqual(historical.datos_snapshot, saved.datos_snapshot);
  assert.equal(historical.contenido_renderizado, saved.contenido_renderizado);
  assert.ok(calls.every(call => call.table === 'documentos_contrato' && !call.insert));
});
test("generación PERSONA con bloques falla antes de insertar; borrador sigue disponible", async () => {
  const data = source();
  const person = data.contract.partes[0].persona;
  data.contract.partes[1] = { id: 'arrendador', rol: 'ARRENDADOR', persona_id: person.id, persona_moral_id: null, persona: person };
  queueGeneration({ data, html: '{{arrendador.bloques.firma}}' });
  await assert.rejects(service.generateContractDocument('contrato', 'version-seleccionada'), /bloques contractuales aprobados para persona física/);
  assert.equal(inserts().length, 0);
  assert.ok(!calls.some(call => call.table === 'documentos_contrato'));
});
