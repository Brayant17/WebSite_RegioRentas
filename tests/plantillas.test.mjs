import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import { JSDOM } from "jsdom";

const calls = [];
let responses = new Map();
globalThis[Symbol.for("plantillas.test.supabase")] = {
  from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    function response() {
      const queue = responses.get(table);
      assert.ok(queue?.length, `Consulta inesperada a ${table}`);
      return Promise.resolve(queue.shift());
    }
    const query = {
      select(columns) { call.select = columns; return query; },
      eq(key, value) { call.filters.push([key, value]); return query; },
      order() { return query; },
      maybeSingle: response,
      returns: response,
    };
    return query;
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabaseClient") return {
      url: `data:text/javascript,${encodeURIComponent('export const supabase = globalThis[Symbol.for("plantillas.test.supabase")];')}`,
      shortCircuit: true,
    };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (context.parentURL?.includes("/src/modules/admin/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const format = await import("../src/modules/admin/arrendamiento/contratos/plantillas/utils/formatters.ts");
const { buildContractTemplateContext } = await import("../src/modules/admin/arrendamiento/contratos/plantillas/services/context.service.ts");
const { renderContractTemplate, TEMPLATE_VARIABLES } = await import("../src/modules/admin/arrendamiento/contratos/plantillas/renderer.ts");
const service = await import("../src/modules/admin/arrendamiento/contratos/plantillas/services/template.service.ts");
// DOMPurify usa el DOM real de jsdom; no se simula el sanitizer. No se ejecutan scripts.
const dom = new JSDOM("");
globalThis.window = dom.window;
const { sanitizeContractHtml, createPreviewDocument } = await import("../src/modules/admin/arrendamiento/contratos/plantillas/sanitize.ts");

function fixture() {
  const person = { id: "persona", nombre: "Ana", apellido_paterno: "Pérez", apellido_materno: null, rfc: "RFC", curp: null, domicilio_origen: "Calle 1", telefono: null, correo: "ana@example.com" };
  return {
    contract: {
      id: "contrato", estado: "BORRADOR", arrendador_persona_moral_id: "empresa-del-contrato", folio: "CTR-2026-000001",
      fecha_inicio: "2026-10-01", fecha_fin: "2027-09-30", renta: "12000.50", deposito: 12000, dia_pago: 1, fecha_firma: null, lugar_firma: null,
      partes: [{ id: "parte", rol: "ARRENDATARIO", persona_id: person.id, persona_moral_id: null, persona: person }, { id: "arrendador", rol: "ARRENDADOR", persona_id: null, persona_moral_id: "empresa-del-contrato", persona: null }],
      unidad: { nombre: "Local A", numero: "A", tipo: "Local", piso: 0, ubicacion: null,
        edificio: { nombre: "Edificio", direccion: "Calle 2", ciudad: "Monterrey", estado: "Nuevo León", codigo_postal: "64000" } },
    },
    landlord: { id: "empresa-del-contrato", razon_social: "Empresa del contrato", nombre_comercial: null, rfc: null, domicilio: "Calle 3", ciudad: null, estado: null, codigo_postal: null, telefono: null, correo: null, estatus: "ACTIVA" },
    representatives: [{ id: "representante", caracter: "REPRESENTANTE_LEGAL", persona: { ...person, nombre: "Manuel" } }],
  };
}
const ok = data => ({ data, error: null });
function mockContext(source = fixture()) {
  responses.set("contratos", [ok(source.contract)]);
  responses.set("personas_morales", [ok(source.landlord)]);
  responses.set("representantes_persona_moral", [ok(source.representatives)]);
}
beforeEach(() => { calls.length = 0; responses = new Map(); });

test("nombre completo omite componentes vacíos y espacios duplicados", () => {
  assert.equal(format.fullName({ nombre: "  Ana   María ", apellido_paterno: " Pérez ", apellido_materno: null }), "Ana María Pérez");
  assert.equal(format.fullName(null), "");
});
test("DATE normal y en letra no dependen de la zona horaria", () => {
  assert.equal(format.formatDate("2026-10-01"), "01/10/2026");
  assert.equal(format.dateInWords("2026-10-01"), "1 de octubre de 2026");
  assert.equal(format.formatDate("2024-02-29"), "29/02/2024");
  assert.throws(() => format.formatDate("2026-02-29"), /inválida/);
  assert.throws(() => format.formatDate("2026-10-01T00:00:00Z"), /inválida/);
});
test("moneda MXN preserva los centavos sin redondeos silenciosos", () => {
  assert.equal(format.formatMoney(12000), "$12,000.00");
  assert.equal(format.formatMoney("12000.05"), "$12,000.05");
  assert.equal(format.formatMoney("0.1"), "$0.10");
  assert.equal(format.formatMoney("9999999999.99"), "$9,999,999,999.99");
  for (const value of ["$12,000", "12,000", "1.005", -1, Infinity, "10000000000"]) assert.throws(() => format.formatMoney(value));
});
test("cantidad en letra, centavos, singular, apócopes y millones", () => {
  for (const [amount, expected] of [
    [12000, "DOCE MIL PESOS 00/100 M.N."], ["12000.50", "DOCE MIL PESOS 50/100 M.N."],
    ["0.01", "CERO PESOS 01/100 M.N."], [1, "UN PESO 00/100 M.N."], [21, "VEINTIÚN PESOS 00/100 M.N."],
    [31, "TREINTA Y UN PESOS 00/100 M.N."], [100, "CIEN PESOS 00/100 M.N."], [101, "CIENTO UN PESOS 00/100 M.N."],
    [500, "QUINIENTOS PESOS 00/100 M.N."], [1000, "MIL PESOS 00/100 M.N."], [21000, "VEINTIÚN MIL PESOS 00/100 M.N."],
    [1000000, "UN MILLÓN DE PESOS 00/100 M.N."], [21000000, "VEINTIÚN MILLONES DE PESOS 00/100 M.N."],
    [1000000000, "MIL MILLONES DE PESOS 00/100 M.N."],
  ]) assert.equal(format.moneyInWords(amount), expected);
});
test("dirección completa limpia separadores y no agrega la unidad", () => {
  assert.equal(format.fullAddress({ direccion: "  Calle  1,, ", ciudad: null, estado: "Nuevo León", codigo_postal: " 64000 " }), "Calle 1, Nuevo León, 64000");
  assert.equal(format.fullAddress({ direccion: "null", ciudad: "undefined", estado: null }), "");
});
test("caracteres del representante y valores vacíos", () => {
  for (const [key, label] of Object.entries({ REPRESENTANTE_LEGAL: "Representante legal", APODERADO_LEGAL: "Apoderado legal", ADMINISTRADOR: "Administrador", OTRO: "Otro" })) assert.equal(format.representativeCharacter(key), label);
  assert.equal(format.representativeCharacter(null), "");
  assert.throws(() => format.representativeCharacter("toString"));
});
test("contexto JSON sin fiador usa vacíos y conserva piso cero", () => {
  const context = buildContractTemplateContext(fixture());
  assert.deepEqual(JSON.parse(JSON.stringify(context)), context);
  assert.ok(Object.values(context.fiador).every(value => value === ""));
  assert.equal(context.unidad.piso, "0");
  assert.equal(context.contrato.fecha_firma, "");
  assert.equal(context.arrendador.representante.nombre_completo, "Manuel Pérez");
  assert.equal(context.arrendador.razon_social, "Empresa del contrato");
  assert.equal(context.inmueble.direccion_completa.includes("Local A"), false);
});
test("catálogo mantiene las 53 variables existentes y agrega cuatro de 2B.2", () => {
  function leaves(object, prefix = "") {
    return Object.entries(object).flatMap(([key, value]) => typeof value === "object" ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
  }
  assert.equal(TEMPLATE_VARIABLES.length, 60);
  assert.deepEqual([...TEMPLATE_VARIABLES].sort(), leaves((({valores_contractuales,...presentation})=>presentation)(buildContractTemplateContext(fixture()))).filter(name => !["arrendador.bloques.revision", "arrendador.bloques.tipo"].includes(name)).sort());
});
test("sustituye todas las apariciones y tolera espacios alrededor del placeholder", () => {
  const context = buildContractTemplateContext(fixture());
  const result = renderContractTemplate("<p>{{contrato.renta}} / {{ contrato.renta }} / {{contrato.folio}}</p>", context);
  assert.equal(result.html, "<p>$12,000.50 / $12,000.50 / CTR-2026-000001</p>");
  assert.deepEqual(result.unresolvedVariables, []);
});
test("variables desconocidas y expresiones permanecen identificables, únicas y ordenadas", () => {
  const context = buildContractTemplateContext(fixture());
  const result = renderContractTemplate("{{contrato.no_existe}} {{contrato.no_existe}} {{constructor.constructor}} {{ 2 + 2 }}", context);
  assert.deepEqual(result.unresolvedVariables, ["2 + 2", "constructor.constructor", "contrato.no_existe"]);
  assert.match(result.html, /{{contrato.no_existe}}/);
  assert.equal(result.html.includes("{{constructor.constructor}}"), true);
});
test("null, undefined y sus textos se sustituyen por vacío sin marcar variable desconocida", () => {
  for (const value of [null, undefined, "null", " undefined "]) {
    const context = buildContractTemplateContext(fixture());
    context.contrato.lugar_firma = value;
    assert.deepEqual(renderContractTemplate("<p>{{contrato.lugar_firma}}</p>", context), { html: "<p></p>", unresolvedVariables: [] });
    assert.equal(format.formatDate(value), "");
    assert.equal(format.moneyInWords(value), "");
  }
});
test("escapa HTML y no resuelve placeholders introducidos dentro de los datos", () => {
  const context = buildContractTemplateContext(fixture());
  context.arrendatario.nombre_completo = '<script>alert(1)</script> & "hola"';
  const result = renderContractTemplate("<p>{{arrendatario.nombre_completo}}</p>", context);
  assert.equal(result.html, "<p>&lt;script&gt;alert(1)&lt;/script&gt;&#32;&amp;&#32;&quot;hola&quot;</p>");
  context.arrendatario.nombre_completo = "{{contrato.folio}}";
  assert.equal(renderContractTemplate("{{arrendatario.nombre_completo}}", context).html, "{{contrato.folio}}");
});
test("rechaza cero o múltiples arrendatarios sin elegir arbitrariamente", () => {
  for (const count of [0, 2]) {
    const source = fixture();
    source.contract.partes = Array.from({ length: count }, () => source.contract.partes[0]);
    assert.throws(() => buildContractTemplateContext(source), /exactamente un ARRENDATARIO/);
  }
});
test("permite un fiador, pero rechaza múltiples fiadores", () => {
  const source = fixture();
  source.contract.partes.push({ ...source.contract.partes[0], rol: "FIADOR" });
  assert.equal(buildContractTemplateContext(source).fiador.nombre_completo, "Ana Pérez");
  source.contract.partes.push({ ...source.contract.partes[0], rol: "FIADOR" });
  assert.throws(() => buildContractTemplateContext(source), /máximo un FIADOR/);
});
test("exige exactamente un representante principal con persona legible", () => {
  for (const count of [0, 2]) {
    const source = fixture();
    source.representatives = Array.from({ length: count }, () => source.representatives[0]);
    assert.throws(() => buildContractTemplateContext(source), /exactamente un representante/);
  }
  const source = fixture();
  source.representatives[0].persona = null;
  assert.throws(() => buildContractTemplateContext(source), /persona representante/);
});
test("una persona moral distinta a la del contrato no se acepta", () => {
  const source = fixture();
  source.landlord.id = "configuracion-global-actual";
  assert.throws(() => buildContractTemplateContext(source), /no corresponde/);
});
test("carga el contexto con tres consultas, sin solicitudes ni configuración global", async () => {
  mockContext();
  const result = await service.loadContractTemplateContext("contrato");
  assert.equal(result.arrendatario.nombre_completo, "Ana Pérez");
  assert.deepEqual(calls.map(call => call.table).sort(), ["contratos", "personas_morales", "representantes_persona_moral"]);
  assert.deepEqual(calls.find(call => call.table === "personas_morales").filters, [["id", "empresa-del-contrato"]]);
  assert.deepEqual(calls.find(call => call.table === "representantes_persona_moral").filters, [["persona_moral_id", "empresa-del-contrato"], ["es_principal", true]]);
  assert.match(calls[0].select, /partes:partes_contrato/);
});
test("preview carga versión BORRADOR y contexto, y reporta variables desconocidas", async () => {
  mockContext();
  responses.set("versiones_plantilla", [ok({ id: "version", plantilla_id: "plantilla", numero_version: 1, estado: "BORRADOR", plantilla: { id: "plantilla", nombre: "Contrato" }, contenido: "<p>{{contrato.folio}} {{no.existe}}</p>" })]);
  const result = await service.loadContractTemplatePreview("contrato", "version");
  assert.deepEqual(result.unresolvedVariables, ["no.existe"]);
  assert.ok(calls.find(call => call.table === "versiones_plantilla").filters.some(([key, value]) => key === "estado" && value === "BORRADOR"));
  assert.equal(calls.length, 4);
});
test("descubre todas las opciones sin elegir ni cargar contenidos arbitrariamente", async () => {
  responses.set("versiones_plantilla", [ok([{ id: "a" }, { id: "b" }])]);
  assert.equal((await service.listDraftTemplateVersions()).length, 2);
  assert.equal(calls[0].select.includes("contenido"), false);
});
test("contratos fuera de BORRADOR y errores Supabase no producen contextos parciales", async () => {
  const source = fixture(); source.contract.estado = "ACTIVO";
  mockContext(source);
  await assert.rejects(service.loadContractTemplateContext("contrato"), /BORRADOR/);
  responses.set("contratos", [{ data: null, error: { code: "42501" } }]);
  await assert.rejects(service.loadContractTemplateContext("contrato"), error => error.code === "42501");
});
test("DOMPurify elimina scripts, handlers, SVG, URLs, formularios y frames", () => {
  const html = sanitizeContractHtml('<script>alert(1)</script><p onclick="alert(1)">Texto</p><img src="https://evil.test" onerror="alert(1)"><svg onload="alert(1)"></svg><a href="javascript:alert(1)">enlace</a><form><input autofocus onfocus="alert(1)"></form><iframe srcdoc="x"></iframe><style>@import url(https://evil.test)</style>');
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll("script,img,svg,a,form,input,iframe,style").length, 0);
  assert.equal(document.querySelector("p").attributes.length, 0);
  assert.match(document.body.textContent, /Texto/);
});
test("escape más sanitización mantiene datos maliciosos como texto y conserva tablas", () => {
  const context = buildContractTemplateContext(fixture());
  context.arrendatario.nombre_completo = '<script>alert(1)</script>';
  const result = renderContractTemplate('<table><tr><td>{{arrendatario.nombre_completo}}</td></tr></table>', context);
  const document = new JSDOM(sanitizeContractHtml(result.html)).window.document;
  assert.equal(document.querySelector("script"), null);
  assert.equal(document.querySelector("td").textContent, '<script>alert(1)</script>');
});
test("una variable no abre atributos, ni siquiera cuando la plantilla omite comillas", () => {
  const context = buildContractTemplateContext(fixture());
  context.unidad.nombre = "x onclick=alert(1)";
  const document = new JSDOM(renderContractTemplate('<p title={{unidad.nombre}}>Texto</p>', context).html).window.document;
  assert.equal(document.querySelector("p").hasAttribute("onclick"), false);
  assert.equal(document.querySelector("p").getAttribute("title"), "x onclick=alert(1)");
});
test("documento de preview usa CSP fijo y no permite que la plantilla lo sustituya", () => {
  const document = new JSDOM(createPreviewDocument('<meta http-equiv="Content-Security-Policy" content="script-src *"><p>Prueba</p>')).window.document;
  const policies = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
  assert.equal(policies.length, 1);
  assert.match(policies[0].content, /script-src 'none'/);
  assert.match(policies[0].content, /default-src 'none'/);
  assert.equal(document.querySelector("p").textContent, "Prueba");
});


test("2B.2: contexto y placeholders de contrato, separados de los domicilios de personas", async () => {
  const data=fixture();
  Object.assign(data.contract,{costo_lavanderia:"1250.125",domicilio_arrendador:"Contrato A",domicilio_arrendatario:"Contrato B",domicilio_fiador:"Contrato C"});
  mockContext(data);
  const context=await service.loadContractTemplateContext("contrato");
  for(const key of ["costo_lavanderia","domicilio_arrendador","domicilio_arrendatario","domicilio_fiador"]) assert.ok(calls[0].select.includes(key));
  assert.equal(context.valores_contractuales.costo_lavanderia,1250.125);
  assert.equal(context.contrato.costo_lavanderia,"$1,250.13");
  assert.equal(context.contrato.domicilio_arrendador,"Contrato A");assert.equal(context.contrato.domicilio_arrendatario,"Contrato B");assert.equal(context.contrato.domicilio_fiador,"Contrato C");
  assert.equal(context.arrendador.domicilio,"Calle 3");assert.equal(context.arrendatario.domicilio,"Calle 1");
  const rendered=renderContractTemplate("{{contrato.costo_lavanderia}}|{{contrato.domicilio_arrendador}}|{{contrato.domicilio_arrendatario}}|{{contrato.domicilio_fiador}}",context);
  assert.deepEqual(rendered,{html:"$1,250.13|Contrato&#32;A|Contrato&#32;B|Contrato&#32;C",unresolvedVariables:[]});
});

test("2B.2: NULL, ausencias históricas y cero conservan significados distintos", () => {
  for(const value of [null,undefined]) {
    const data=fixture();Object.assign(data.contract,{costo_lavanderia:value,domicilio_arrendador:value,domicilio_arrendatario:value,domicilio_fiador:value});
    const context=buildContractTemplateContext(data);
    assert.equal(context.valores_contractuales.costo_lavanderia,null);
    for(const key of ["costo_lavanderia","domicilio_arrendador","domicilio_arrendatario","domicilio_fiador"]) assert.equal(context.contrato[key],"");
    assert.equal(renderContractTemplate("{{contrato.costo_lavanderia}}{{contrato.domicilio_arrendador}}{{contrato.domicilio_arrendatario}}{{contrato.domicilio_fiador}}",context).html,"");
  }
  const data=fixture();data.contract.costo_lavanderia=0;
  const context=buildContractTemplateContext(data);
  assert.equal(context.valores_contractuales.costo_lavanderia,0);assert.equal(context.contrato.costo_lavanderia,"$0.00");
  assert.deepEqual(JSON.parse(JSON.stringify(context)),context);
});


const v2Proposal=JSON.parse((await import('node:fs')).readFileSync(new URL('../docs/contratos-v2-propuesta-fragmentos.json',import.meta.url),'utf8'));
test("propuesta V2: solo sustituye los fragmentos autorizados de SEGUNDA, CUARTA y DÉCIMA",()=>{
 const [second,fourth,tenth]=v2Proposal.fragmentos;
 assert.equal(second.despues,second.antes.replace('$200 pesos','{{contrato.costo_lavanderia}}'));
 assert.equal(fourth.despues,fourth.antes.replace('es por 1 (UN) AÑO forzoso para las partes, contado','será contada'));
 assert.equal(tenth.despues,tenth.antes.replace('{{arrendador.domicilio}}\n{{arrendador.ciudad}}, {{arrendador.estado}},\n{{arrendador.codigo_postal}}','{{contrato.domicilio_arrendador}}').replace('{{arrendatario.domicilio}}','{{contrato.domicilio_arrendatario}}').replace('{{fiador.domicilio}}','{{contrato.domicilio_fiador}}'));
 for(const fragment of v2Proposal.fragmentos)for(const token of fragment.despues.matchAll(/{{([^}]+)}}/g))assert.ok(TEMPLATE_VARIABLES.includes(token[1]),token[1]);
});
for(const tipo of ['PERSONA','PERSONA_MORAL'])test('propuesta V2: fragmentos renderizan para '+tipo+' con plazo variable',()=>{
 const data=fixture();
 Object.assign(data.contract,{fecha_inicio:'2026-10-01',fecha_fin:'2027-03-31',costo_lavanderia:0,domicilio_arrendador:'Contractual A',domicilio_arrendatario:'Contractual B',domicilio_fiador:'Contractual C'});
 if(tipo==='PERSONA'){
  const person=data.contract.partes[0].persona;
  data.contract.partes[1]={id:'arrendador',rol:'ARRENDADOR',persona_id:person.id,persona_moral_id:null,persona:person};
  data.landlordPerson=person;data.landlord=null;data.representatives=[];
 }
 const context=buildContractTemplateContext(data);
 const texts=v2Proposal.fragmentos.map(f=>{const result=renderContractTemplate(f.despues,context);assert.deepEqual(result.unresolvedVariables,[]);return new JSDOM('<body>'+result.html+'</body>').window.document.body.textContent;});
 assert.equal(texts[0],'El uso de la lavandería sería un costo adicional de $0.00 mensuales por persona, en caso de requerir dicho servicio.');
 assert.equal(texts[1],'que la duración del presente Contrato será contada a partir del 1 de octubre de 2026, para concluir el día 31 de marzo de 2027.');
 assert.equal(texts[2],'ARRENDADOR:\nContractual A\n\nARRENDATARIO:\nContractual B\n\nFIADOR:\nContractual C');
 // Las referencias corporativas originales siguen válidas, pero vacías para PERSONA.
 const corporate=renderContractTemplate('{{arrendador.razon_social}}|{{arrendador.representante.caracter}}|{{arrendador.representante.nombre_completo}}',context);
 assert.deepEqual(corporate.unresolvedVariables,[]);
 if(tipo==='PERSONA')assert.equal(corporate.html,'||');else assert.ok(corporate.html.includes('Empresa'));
});
test('propuesta V2: NULL no inventa tarifa ni domicilio; textos fijos permanecen',()=>{
 const context=buildContractTemplateContext(fixture());
 const rendered=renderContractTemplate(v2Proposal.fragmentos[0].despues,context);
 assert.deepEqual(rendered.unresolvedVariables,[]);
 assert.ok(rendered.html.includes('adicional de  mensuales'));
 assert.ok(!rendered.html.includes('null'));assert.ok(!rendered.html.includes('undefined'));
});


const v1Real=(await import('node:fs')).readFileSync(new URL('../docs/plantillas/contrato-habitacional-v1-referencia.html',import.meta.url),'utf8');
const v2Real=(await import('node:fs')).readFileSync(new URL('../docs/plantillas/contrato-habitacional-v2-propuesta.html',import.meta.url),'utf8');
const v2Manifest=JSON.parse((await import('node:fs')).readFileSync(new URL('../docs/plantillas/contrato-habitacional-v2-cambios.json',import.meta.url),'utf8'));
test('V2 completa: cinco sustituciones exactas y resto de V1 idéntico',async()=>{
 const {createHash}=await import('node:crypto');
 assert.equal(createHash('sha256').update(v1Real).digest('hex'),v2Manifest.v1_sha256);
 assert.equal(v2Manifest.sustituciones.length,5);
 let expected=v1Real;
 for(const edit of v2Manifest.sustituciones){assert.equal(expected.split(edit.antes).length,2);expected=expected.replace(edit.antes,edit.despues);}
 assert.equal(v2Real,expected);assert.equal(createHash('sha256').update(v2Real).digest('hex'),v2Manifest.v2_sha256);
 const delimiters=['<strong>SEGUNDA:','<strong>TERCERA:','<strong>CUARTA:','<strong>QUINTA:','<strong>DÉCIMA:','<strong>DÉCIMA PRIMERA:'];
 const unaffected=html=>{let result=html;for(let i=0;i<delimiters.length;i+=2){const start=result.indexOf(delimiters[i]),end=result.indexOf(delimiters[i+1]);assert.ok(start>=0&&end>start);result=result.slice(0,start)+result.slice(end);}return result;};
 assert.equal(unaffected(v1Real),unaffected(v2Real));
 const tokens=[...v2Real.matchAll(/{{([^}]+)}}/g)].map(m=>m[1]);
 assert.equal(new Set(tokens).size,20);
 for(const token of tokens)assert.ok(TEMPLATE_VARIABLES.includes(token),token);
});
for(const tipo of ['PERSONA','PERSONA_MORAL'])test('V2 completa: renderer '+tipo+' sin placeholders desconocidos, conserva advertencia textual corporativa',()=>{
 const data=fixture();Object.assign(data.contract,{fecha_inicio:'2026-10-01',fecha_fin:'2027-03-31',costo_lavanderia:250,domicilio_arrendador:'Domicilio contractual A',domicilio_arrendatario:'Domicilio contractual B',domicilio_fiador:'Domicilio contractual C'});
 if(tipo==='PERSONA') {const person=data.contract.partes[0].persona;data.contract.partes[1]={id:'arrendador',rol:'ARRENDADOR',persona_id:person.id,persona_moral_id:null,persona:person};data.landlordPerson=person;data.landlord=null;data.representatives=[];}
 const rendered=renderContractTemplate(v2Real,buildContractTemplateContext(data));assert.deepEqual(rendered.unresolvedVariables,[]);
 const text=new JSDOM(rendered.html).window.document.body.textContent;
 assert.ok(text.includes('$250.00'));assert.ok(!text.includes('$200 pesos'));assert.ok(!text.includes('1 (UN) AÑO'));
 for(const suffix of ['A','B','C'])assert.ok(text.includes('Domicilio contractual '+suffix));
 assert.ok(text.includes('sociedad anónima de capital variable')); // Conservada, no compatible automáticamente con PERSONA.
 if(tipo==='PERSONA')assert.ok(!text.includes('Empresa del contrato'));else assert.ok(text.includes('Empresa del contrato'));
});

const blocksModule = await import("../src/modules/admin/arrendamiento/contratos/plantillas/services/landlordBlocks.ts");
test("bloques moral son fragmentos literales V1 y se insertan sin cambiar su HTML", async () => {
  const { readFile } = await import("node:fs/promises");
  const original = await readFile(new URL("../docs/plantillas/contrato-habitacional-v1-referencia.html", import.meta.url), "utf8");
  const context = buildContractTemplateContext(fixture());
  context.arrendador.bloques = blocksModule.buildLandlordBlocks(context.arrendador, blocksModule.LEGACY_LANDLORD_BLOCK_REVISION);
  let skeleton = original;
  for (const [name, fragment] of Object.entries(blocksModule.MORAL_BLOCK_TEMPLATES)) {
    assert.ok(original.includes(fragment));
    skeleton = skeleton.replace(fragment, "{{arrendador.bloques." + name + "}}");
    assert.equal(context.arrendador.bloques[name], renderContractTemplate(fragment, context).html);
  }
  assert.equal(renderContractTemplate(skeleton, context).html, renderContractTemplate(original, context).html);
  assert.equal(context.arrendador.bloques.revision, "arrendador-v1-moral-1");
  assert.equal(context.arrendador.bloques.tipo, "PERSONA_MORAL");
});
test("bloques escapan datos, conservan formato y no permiten HTML arbitrario", () => {
  const data = fixture();
  data.landlord.razon_social = '<img src=x onerror=alert(1)> & {{contrato.folio}}';
  data.representatives[0].persona.nombre = '<script>alert(1)</script>';
  const context = buildContractTemplateContext(data);
  const rendered = renderContractTemplate('<p>{{arrendador.bloques.comparecencia}}</p><p>{{arrendador.razon_social}}</p>', context).html;
  assert.ok(rendered.includes('<strong>'));
  assert.ok(rendered.includes('&lt;img'));
  assert.ok(!rendered.includes('<img'));
  assert.ok(!rendered.includes('<script>'));
  assert.ok(rendered.includes('{{contrato.folio}}'));
  const clean = sanitizeContractHtml(rendered);
  assert.ok(clean.includes('<strong>'));
  assert.ok(!clean.includes('<img'));
  context.arrendador.bloques.firma = '<img src=x onerror=alert(1)>';
  assert.throws(() => renderContractTemplate('{{arrendador.bloques.firma}}', context), /revisión aprobada/);
});
test("PERSONA y contextos históricos funcionan sin bloques; plantilla que los requiere falla", () => {
  const data = fixture();
  const person = data.contract.partes[0].persona;
  data.contract.partes[1] = { id: 'arrendador', rol: 'ARRENDADOR', persona_id: person.id, persona_moral_id: null, persona: person };
  data.landlordPerson = person;
  const context = buildContractTemplateContext(data);
  assert.equal(context.arrendador.bloques, undefined);
  assert.doesNotThrow(() => renderContractTemplate('{{arrendador.nombre}}', context));
  for (const variable of blocksModule.LANDLORD_BLOCK_VARIABLES) {
    assert.throws(() => renderContractTemplate('{{' + variable + '}}', context), /bloques contractuales aprobados para persona física/);
  }
  const historical = buildContractTemplateContext(fixture());
  delete historical.arrendador.bloques;
  assert.doesNotThrow(() => renderContractTemplate('{{arrendador.razon_social}}', historical));
  assert.throws(() => renderContractTemplate('{{arrendador.bloques.firma}}', historical), /no están resueltos/);
});

const contractWords = html => new JSDOM(html.replace(/<p(?: [^>]*)?>/g,tag=>' '+tag).replace(/<br\s*\/?>/g,' ').replace(/<\/(p|h[1-6]|td)>/g,tag=>' '+tag)).window.document.body.textContent.replace(/\s+/g,' ').trim();
const v2Final = (await import('node:fs')).readFileSync(new URL('../docs/plantillas/contrato-habitacional-v2-final.html',import.meta.url),'utf8');
test('V2 final: exactamente tres bloques, catálogo válido y ninguna referencia corporativa exterior',()=>{
 let expected=v2Real;
 for(const [key,fragment] of Object.entries(blocksModule.MORAL_BLOCK_TEMPLATES)){
  assert.equal(expected.split(fragment).length,2);
  expected=expected.replace(fragment,'{{arrendador.bloques.'+key+'}}');
 }
 assert.equal(contractWords(v2Final),contractWords(expected));
 assert.deepEqual([...v2Final.matchAll(/{{([^}]+)}}/g)].map(m=>m[1]),[...expected.matchAll(/{{([^}]+)}}/g)].map(m=>m[1]));
 assert.doesNotMatch(v2Final,/arrendador\.(razon_social|representante)|sociedad|su representada|su mandante|facultades conferidas|1 \(UN\) AÑO/);
 for(const [,token] of v2Final.matchAll(/{{([^}]+)}}/g))assert.ok(TEMPLATE_VARIABLES.includes(token),token);
});
for(const laundry of [250,0,null])test('V2 final: moral conserva exactamente render anterior, lavandería '+laundry,()=>{
 const data=fixture(); Object.assign(data.contract,{costo_lavanderia:laundry,domicilio_arrendador:laundry===null?null:'Domicilio A',domicilio_arrendatario:laundry===null?null:'Domicilio B',domicilio_fiador:laundry===null?null:'Domicilio C'});
 const context=buildContractTemplateContext(data),result=renderContractTemplate(v2Final,context);
 assert.deepEqual(result.unresolvedVariables,[]);
 assert.equal(contractWords(result.html),contractWords(renderContractTemplate(v2Real,context).html));
 const text=new JSDOM(sanitizeContractHtml(result.html)).window.document.body.textContent;
 assert.ok(!text.includes('undefined')&&!text.includes('null'));
 if(laundry!==null)assert.ok(text.includes(laundry===0?'$0.00':'$250.00'));
 else assert.ok(text.includes('adicional de '));
});
test('V2 final: PERSONA falla explícitamente sin heredar redacción moral',()=>{
 const data=fixture(),person=data.contract.partes[0].persona;
 data.contract.partes[1]={id:'arrendador',rol:'ARRENDADOR',persona_id:person.id,persona_moral_id:null,persona:person};data.landlordPerson=person;
 const context=buildContractTemplateContext(data);
 assert.equal(context.arrendador.bloques,undefined);
 assert.throws(()=>renderContractTemplate(v2Final,context),/bloques contractuales aprobados para persona física/);
});

test('V2 maquetación: párrafos naturales, incisos separados, inventario y firmas conservados',()=>{
 const context=buildContractTemplateContext(fixture());
 assert.equal(context.arrendador.bloques.revision,'arrendador-v2-moral-maquetacion-1');
 for(const key of ['comparecencia','antecedentes_identidad']){
  assert.ok(!context.arrendador.bloques[key].includes('<br>'));
  assert.equal(contractWords(blocksModule.MORAL_BLOCK_TEMPLATES[key]),contractWords(blocksModule.MORAL_FLOW_BLOCK_TEMPLATES[key]));
 }
 assert.equal(blocksModule.MORAL_FLOW_BLOCK_TEMPLATES.firma,blocksModule.MORAL_BLOCK_TEMPLATES.firma);
 const doc=new JSDOM(renderContractTemplate(v2Final,context).html).window.document;
 assert.equal([...doc.querySelectorAll('p')].filter(p=>p.textContent.trim().startsWith('a) Que su representada')).length,1);
 for(const [start,end,count] of [['OCTAVA:','NOVENA:',11],['NOVENA:','DÉCIMA:',5]]){
  const section=v2Final.slice(v2Final.indexOf(start),v2Final.indexOf(end));
  assert.equal((section.match(/<p>[a-k]\)/g)||[]).length,count);
 }
 for(const p of doc.querySelectorAll('p'))if(!p.textContent.includes('________'))assert.equal(p.querySelectorAll('br').length,0);
 assert.equal(doc.querySelectorAll('td').length,3);
 assert.ok(doc.querySelector('td br'));
 const inventory=[...doc.querySelectorAll('p')].find(p=>p.textContent.includes('________'));
 assert.equal(inventory.innerHTML.match(/_{10,}/g).length,5);
 assert.ok(inventory.querySelector('br'));
});

test('firma: contexto y cierre V2 conservan fecha de calendario en distintas zonas horarias',()=>{
 const previous=process.env.TZ;
 try{
 for(const zone of ['UTC','America/Mexico_City','Pacific/Kiritimati']){
 process.env.TZ=zone;const data=fixture();data.contract.fecha_firma='2026-10-05';data.contract.lugar_firma='Monterrey, Nuevo León';
 const context=buildContractTemplateContext(data);assert.equal(context.contrato.fecha_firma,'05/10/2026');assert.equal(context.contrato.fecha_firma_letra,'5 de octubre de 2026');
 const result=renderContractTemplate(v2Final,context);assert.deepEqual(result.unresolvedVariables,[]);
 const text=contractWords(result.html);assert.ok(text.includes('CONTRATO EN Monterrey, Nuevo León, EL DÍA 5 de octubre de 2026'));
 data.contract.fecha_firma=null;data.contract.lugar_firma=null;const empty=buildContractTemplateContext(data);assert.equal(empty.contrato.fecha_firma_letra,'');assert.equal(empty.contrato.lugar_firma,'');
 }
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
