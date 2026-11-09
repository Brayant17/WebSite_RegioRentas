import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

// Node 24: carga TypeScript y sustituye únicamente el cliente de Supabase.
// No se conecta a la base de datos ni crea contratos reales.
const calls = [];
let response;
const query = {
  then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
};
for (const method of ["select", "eq", "update", "order", "returns", "maybeSingle"]) {
  query[method] = (...args) => { calls.push([method, ...args]); return query; };
}
globalThis[Symbol.for("contratos.test.supabase")] = {
  from: (...args) => { calls.push(["from", ...args]); return query; },
  rpc: (...args) => { calls.push(["rpc", ...args]); return Promise.resolve(response); },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabaseClient") return {
      url: `data:text/javascript,${encodeURIComponent('export const supabase = globalThis[Symbol.for("contratos.test.supabase")];')}`,
      shortCircuit: true,
    };
    if (context.parentURL?.includes("/contratos/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const repository = await import("../src/modules/admin/arrendamiento/contratos/repositories/contratos.repository.ts");
const service = await import("../src/modules/admin/arrendamiento/contratos/services/contratos.service.ts");
const landlord = { tipo: "PERSONA", id: "11111111-1111-4111-8111-111111111111" };
const values = { fecha_inicio: "2026-10-01", fecha_fin: "2027-09-30", renta: "12000", deposito: "0", dia_pago: "1" };
beforeEach(() => { calls.length = 0; response = { data: null, error: null }; });

test("precarga importes claros sin reinterpretar moneda, miles ni textos incompletos", () => {
  for (const value of ["12000", "12000.50", 12000, " 12000.50 "]) assert.equal(service.parseAmount(value), Number(value));
  for (const value of [null, undefined, "", " ", "$12,000", "12,000", "12.000,50", "12000 pesos", "1e4", "1.234", Infinity, -1, "10000000000"]) {
    assert.equal(service.parseAmount(value), null, String(value));
  }
});

test("rechaza captura inválida antes de realizar una escritura", () => {
  for (const change of [
    { fecha_inicio: "2026-02-30" }, { fecha_fin: "2026-10-01" }, { fecha_fin: "" },
    { renta: "0" }, { renta: "abc" }, { deposito: "" }, { deposito: "-1" },
    { dia_pago: "1.5" }, { dia_pago: "0" }, { dia_pago: "32" },
  ]) assert.throws(() => service.createContract("solicitud", { ...values, ...change }));
  assert.deepEqual(calls, []);
});

test("la creación normal envía ocho parámetros con arrendador explícito y devuelve su UUID", async () => {
  response.data = "contrato-uuid";
  assert.equal(await service.createContract("solicitud-uuid", values, landlord), "contrato-uuid");
  assert.deepEqual(calls, [["rpc", "crear_contrato_desde_solicitud", {
    p_solicitud_id: "solicitud-uuid", p_fecha_inicio: "2026-10-01", p_fecha_fin: "2027-09-30",
    p_renta: 12000, p_deposito: 0, p_dia_pago: 1, p_arrendador_tipo: landlord.tipo, p_arrendador_id: landlord.id,
  }]]);
});

test("una RPC sin identificador no se trata como creación exitosa", async () => {
  await assert.rejects(service.createContract("solicitud", values, landlord), /identificador/);
});

test("la consulta por solicitud distingue ausencia de contrato y error de acceso", async () => {
  assert.equal(await repository.getContractByApplication("solicitud"), null);
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "solicitud_id" && call[2] === "solicitud"));
  response.error = { code: "42501", message: "permission denied" };
  await assert.rejects(repository.getContractByApplication("solicitud"), error => error === response.error);
});

test("la edición excluye campos protegidos y exige BORRADOR en la operación de escritura", async () => {
  response.data = { id: "contrato", estado: "BORRADOR" };
  const terms = service.parseContractForm(values);
  await repository.updateDraftContract("contrato", { ...terms, estado: "ACTIVO", folio: "otro", unidad_id: 99, solicitud_id: "otra" });
  assert.deepEqual(calls.find(call => call[0] === "update"), ["update", terms]);
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === "contrato"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "estado" && call[2] === "BORRADOR"));
});

test("un borrador que cambió de estado o dejó de ser accesible no reporta éxito", async () => {
  await assert.rejects(service.saveDraft("contrato", values), /ya no está en BORRADOR/);
});

test("lista vacía y detalle inexistente son estados válidos", async () => {
  assert.deepEqual(await repository.getContracts(), []);
  assert.equal(await repository.getContractById("contrato"), null);
});

test("los errores críticos de PostgreSQL se convierten en mensajes útiles", () => {
  assert.match(service.contractErrorMessage({ code: "23505", message: "duplicate key" }), /ya tiene un contrato/);
  assert.match(service.contractErrorMessage({ code: "42501", message: "permission denied" }), /cuenta administradora/);
  assert.match(service.contractErrorMessage({ code: "P0001", message: "arrendador no configurado" }), /arrendador configurado/);
  assert.match(service.contractErrorMessage({ code: "P0001", message: "solicitud no aprobada" }), /solicitudes aprobadas/);
  assert.match(service.contractErrorMessage(new TypeError("Failed to fetch")), /conexión/);
});


test("2B.2 valida lavandería opcional y domicilios propios sin alterar condiciones anteriores", () => {
  for (const [raw,expected] of [["",null],["  ",null],["0",0],["125.50",125.5],["1.234",1.234]]) {
    const parsed=service.parseDraftForm({...values,costo_lavanderia:raw,domicilio_arrendador:"  Calle A\nInterior 2  ",domicilio_arrendatario:"",domicilio_fiador:"  "});
    assert.deepEqual(parsed,{...service.parseContractForm(values),costo_lavanderia:expected,domicilio_arrendador:"Calle A\nInterior 2",domicilio_arrendatario:null,domicilio_fiador:null});
  }
  for (const raw of ["-1","NaN","Infinity","1e3","$100","1,000","abc"]) {
    assert.throws(()=>service.saveDraft("contrato",{...values,costo_lavanderia:raw}),/lavandería/);
  }
  assert.deepEqual(calls,[]);
  assert.deepEqual(service.parseDraftForm(values),service.parseContractForm(values));
});

test("2B.2 guarda, recarga y permite limpiar los cuatro campos con NULL", async () => {
  const captured={...values,costo_lavanderia:"0",domicilio_arrendador:"A",domicilio_arrendatario:"B",domicilio_fiador:"C"};
  response.data={id:"contrato",estado:"BORRADOR"};
  await service.saveDraft("contrato",captured);
  const written=calls.find(x=>x[0]==="update")[1];
  assert.deepEqual(written,{...service.parseContractForm(values),costo_lavanderia:0,domicilio_arrendador:"A",domicilio_arrendatario:"B",domicilio_fiador:"C"});
  assert.ok(calls.some(x=>x[0]==="eq"&&x[1]==="estado"&&x[2]==="BORRADOR"));
  calls.length=0;response.data={id:"contrato",estado:"BORRADOR",...written};
  const reloaded=await repository.getContractById("contrato");
  assert.equal(reloaded.costo_lavanderia,0);assert.equal(reloaded.domicilio_fiador,"C");
  const selection=calls.find(x=>x[0]==="select")[1];
  for(const field of ["costo_lavanderia","domicilio_arrendador","domicilio_arrendatario","domicilio_fiador"]) assert.ok(selection.includes(field));
  calls.length=0;
  await service.saveDraft("contrato",{...values,costo_lavanderia:"",domicilio_arrendador:"",domicilio_arrendatario:"",domicilio_fiador:""});
  for(const field of ["costo_lavanderia","domicilio_arrendador","domicilio_arrendatario","domicilio_fiador"]) assert.equal(calls.find(x=>x[0]==="update")[1][field],null);
});

test("2B.2 no permite actualizar arrendador/estado y no informa éxito si BORRADOR ya cambió", async () => {
  response.data=null;
  await assert.rejects(repository.updateDraftContract("contrato",{...service.parseDraftForm({...values,costo_lavanderia:"10"}),arrendador_persona_moral_id:"otra",estado:"ACTIVO"}),/BORRADOR/);
  const patch=calls.find(x=>x[0]==="update")[1];
  assert.equal(patch.costo_lavanderia,10);
  assert.equal(Object.hasOwn(patch,"arrendador_persona_moral_id"),false);
  assert.equal(Object.hasOwn(patch,"estado"),false);
});

test('firma: opcional, trim, DATE válido y rechazo de fechas imposibles',()=>{
 for(const raw of ['', '  ']){const parsed=service.parseDraftForm({...values,lugar_firma:raw,fecha_firma:raw});assert.equal(parsed.lugar_firma,null);assert.equal(parsed.fecha_firma,null);}
 const parsed=service.parseDraftForm({...values,lugar_firma:'  Monterrey, Nuevo León  ',fecha_firma:'2028-02-29'});
 assert.equal(parsed.lugar_firma,'Monterrey, Nuevo León');assert.equal(parsed.fecha_firma,'2028-02-29');assert.ok(!Object.hasOwn(parsed,'estado'));
 for(const fecha_firma of ['2026-02-29','2026-04-31','05/10/2026','2026-10-05T00:00:00Z'])assert.throws(()=>service.saveDraft('contrato',{...values,fecha_firma}),/fecha de firma/);
 assert.equal(calls.length,0);
});
test('firma: guardar y recargar campos sin cambiar estado; limpiar y proteger BORRADOR',async()=>{
 response.data={id:'contrato',estado:'BORRADOR'};
 await service.saveDraft('contrato',{...values,lugar_firma:'  Monterrey  ',fecha_firma:'2026-10-05'});
 const written=calls.find(c=>c[0]==='update')[1];assert.equal(written.lugar_firma,'Monterrey');assert.equal(written.fecha_firma,'2026-10-05');assert.ok(!Object.hasOwn(written,'estado'));
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='estado'&&c[2]==='BORRADOR'));
 response.data={...response.data,...written};calls.length=0;
 const reloaded=await repository.getContractById('contrato');assert.equal(reloaded.fecha_firma,'2026-10-05');assert.equal(reloaded.lugar_firma,'Monterrey');
 const select=calls.find(c=>c[0]==='select')[1];assert.ok(select.includes('fecha_firma')&&select.includes('lugar_firma'));
 calls.length=0;await service.saveDraft('contrato',{...values,lugar_firma:'',fecha_firma:''});const cleared=calls.find(c=>c[0]==='update')[1];assert.equal(cleared.fecha_firma,null);assert.equal(cleared.lugar_firma,null);
 response.data=null;await assert.rejects(service.saveDraft('contrato',{...values,lugar_firma:'X',fecha_firma:'2026-10-05'}),/BORRADOR/);
});
