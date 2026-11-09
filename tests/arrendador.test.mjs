import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

// Node 24, sin conexión ni escrituras a Supabase real.
const calls = [];
let responses = [];
globalThis[Symbol.for("arrendador.test.supabase")] = {
  from(table) {
    const call = { table, filters: [] };
    calls.push(call);
    const query = {
      select(columns) { call.select = columns; return query; },
      eq(key, value) { call.filters.push([key, value]); return query; },
      update(values) { call.update = values; return query; },
      maybeSingle() {
        assert.ok(responses.length, "Consulta inesperada");
        return Promise.resolve(responses.shift());
      },
    };
    return query;
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabaseClient") return {
      url: `data:text/javascript,${encodeURIComponent('export const supabase = globalThis[Symbol.for("arrendador.test.supabase")];')}`,
      shortCircuit: true,
    };
    if (context.parentURL?.includes("/configuracion/arrendador/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const service = await import("../src/modules/admin/configuracion/arrendador/services/arrendador.service.ts");
const repository = await import("../src/modules/admin/configuracion/arrendador/repositories/arrendador.repository.ts");
const companyId = "12345678-1234-4234-9234-123456789abc";
const company = {
  id: companyId, razon_social: "Empresa", nombre_comercial: null, rfc: null, domicilio: null,
  ciudad: null, estado: null, codigo_postal: null, telefono: null, correo: null, estatus: "ACTIVA",
};
const representative = { id: "relacion", persona_moral_id: companyId, persona_id: "persona", caracter: "REPRESENTANTE_LEGAL", es_principal: true, persona: null };
const settings = { company, representative };
const form = service.landlordFormValues(settings);
const ok = data => ({ data, error: null });
const writes = () => calls.filter(call => call.update);
beforeEach(() => { calls.length = 0; responses = []; });

test("descubre el arrendador por la clave y consulta solo su representante principal", async () => {
  responses = [ok({ valor: companyId }), ok(company), ok(representative)];
  assert.deepEqual(await service.loadLandlordSettings(), settings);
  assert.deepEqual(calls.map(call => [call.table, call.filters]), [
    ["configuracion_sistema", [["clave", "arrendador_persona_moral_id"]]],
    ["personas_morales", [["id", companyId]]],
    ["representantes_persona_moral", [["persona_moral_id", companyId], ["es_principal", true]]],
  ]);
  assert.match(calls[2].select, /persona:personas!persona_id/);
});

test("configuración ausente o inválida no conduce a consultas con UUID inventado", async () => {
  for (const setting of [null, { valor: " " }, { valor: "invalido" }]) {
    calls.length = 0;
    responses = [ok(setting)];
    await assert.rejects(service.loadLandlordSettings(), /configurad|identificador/);
    assert.equal(calls.length, 1);
  }
});

test("campos opcionales vacíos permanecen vacíos y se guardan como null", () => {
  const values = service.landlordFormValues({ company, representative: null });
  assert.equal(values.caracter, "");
  assert.equal(values.correo, "");
  const normalized = service.normalizeLandlordForm({ ...values, razon_social: " Empresa ", rfc: " ABC123 ", telefono: "   ", correo: " info@example.com " }, false);
  assert.equal(normalized.company.razon_social, "Empresa");
  assert.equal(normalized.company.rfc, "ABC123");
  assert.equal(normalized.company.telefono, null);
  assert.equal(normalized.company.correo, "info@example.com");
  assert.equal(normalized.caracter, null);
});

test("valida razón social, correo y carácter antes de cualquier consulta o escritura", async () => {
  for (const changes of [{ razon_social: "  " }, { correo: "no-es-correo" }, { caracter: "" }, { caracter: "toString" }]) {
    await assert.rejects(service.saveLandlordSettings(settings, { ...form, ...changes }));
  }
  assert.equal(calls.length, 0);
});

test("guarda exclusivamente los campos permitidos de ambas entidades", async () => {
  responses = [ok({ valor: companyId }), ok(representative), ok(company), ok({ ...representative, caracter: "OTRO" })];
  const result = await service.saveLandlordSettings(settings, { ...form, caracter: "OTRO", estatus: "INACTIVA", persona_id: "otra", es_principal: false });
  assert.equal(result.representative.caracter, "OTRO");
  assert.deepEqual(Object.keys(writes()[0].update).sort(), ["razon_social", "nombre_comercial", "rfc", "domicilio", "ciudad", "estado", "codigo_postal", "telefono", "correo"].sort());
  assert.deepEqual(writes()[1].update, { caracter: "OTRO" });
  assert.deepEqual(writes()[1].filters, [["id", "relacion"], ["persona_moral_id", companyId], ["persona_id", "persona"], ["es_principal", true]]);
  assert.deepEqual(writes().map(call => call.table), ["personas_morales", "representantes_persona_moral"]);
});

test("si falla la persona moral no intenta actualizar al representante", async () => {
  responses = [ok({ valor: companyId }), ok(representative), { data: null, error: { code: "42501" } }];
  await assert.rejects(service.saveLandlordSettings(settings, form), /No se intentó actualizar al representante/);
  assert.equal(writes().length, 1);
});

test("si falla el representante informa que la persona moral sí se guardó", async () => {
  responses = [ok({ valor: companyId }), ok(representative), ok(company), { data: null, error: { code: "42501" } }];
  await assert.rejects(service.saveLandlordSettings(settings, form), /persona moral se guardaron, pero/);
  assert.equal(writes().length, 2);
});

test("no reporta éxito al actualizar una fila inexistente o inaccesible", async () => {
  responses = [ok(null)];
  await assert.rejects(repository.updateLandlordCompany(companyId, company), /no está disponible/);
  responses = [ok(null)];
  await assert.rejects(repository.updateRepresentativeCharacter(representative, "OTRO"), /representante principal cambió/);
});

test("permite guardar la empresa sin inventar ni crear un representante", async () => {
  responses = [ok({ valor: companyId }), ok(null), ok(company)];
  const result = await service.saveLandlordSettings({ company, representative: null }, form);
  assert.equal(result.representative, null);
  assert.equal(writes().length, 1);
});

test("si cambió la configuración o el representante exige recargar sin escribir", async () => {
  responses = [ok({ valor: "87654321-1234-4234-9234-123456789abc" })];
  await assert.rejects(service.saveLandlordSettings(settings, form), /arrendador configurado cambió/);
  responses = [ok({ valor: companyId }), ok({ ...representative, persona_id: "otra" })];
  await assert.rejects(service.saveLandlordSettings(settings, form), /representante principal cambió/);
  assert.equal(writes().length, 0);
});
