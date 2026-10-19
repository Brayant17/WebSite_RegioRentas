import type { BloquesArrendadorResueltos, ContractTemplateContext } from "../types";
import { escapeHtml } from "../utils/escapeHtml";

// Inmutable: fragmentos literales de V1 8f30e17c-6c5e-4a42-9b66-d0d8348d9520.
// Toda redacción futura debe tener otra revisión, sin alterar esta definición.
export const LEGACY_LANDLORD_BLOCK_REVISION = "arrendador-v1-moral-1";
export const LANDLORD_BLOCK_REVISION = "arrendador-v2-moral-maquetacion-1";
export const LANDLORD_BLOCK_VARIABLES = [
  "arrendador.bloques.comparecencia",
  "arrendador.bloques.antecedentes_identidad",
  "arrendador.bloques.firma",
] as const;
export const MORAL_BLOCK_TEMPLATES = Object.freeze({
  "comparecencia": "Que celebran por una parte y en representación de la sociedad mercantil<br>denominada <strong>{{arrendador.razon_social}}</strong>, cuyo<br>{{arrendador.representante.caracter}} es<br><strong>{{arrendador.representante.nombre_completo}}</strong>,<br>a quien se le denominará como EL ARRENDADOR",
  "antecedentes_identidad": "<p><br><strong>I.- EL ARRENDADOR</strong>, a través de su<br>{{arrendador.representante.caracter}}, bajo protesta de decir verdad manifiesta:<br></p><br><br><p><br>a) Que su representada es una sociedad anónima de capital variable,<br>constituida conforme a las leyes vigentes del país, debidamente inscrita<br>en el Registro Público de la Propiedad y Comercio, en la ciudad de<br>Monterrey, Nuevo León.<br></p><br><br><p><br>b) Que en su carácter {{arrendador.representante.caracter}} cuenta con<br>facultades suficientes, para poder llevar a cabo todo tipo de contratos<br>de orden civil y/o mercantil entre otras cosas, y a la fecha de la<br>celebración y firma del presente contrato, las facultades conferidas a<br>su persona no se encuentran revocadas o modificadas en forma alguna,<br>por lo que cuenta con capacidad jurídica para comprometer y obligar<br>a su mandante.<br></p><br><br>",
  "firma": "{{arrendador.razon_social}}<br><br>                {{arrendador.representante.caracter}}<br><br>                {{arrendador.representante.nombre_completo}}"
});

// Solo estructura: la revisión original permanece intacta para reproducibilidad.
const naturalParagraphs = (html: string) => html.replace(/<br>/g, " ")
  .replace(/ +/g, " ").replace(/> +</g, ">\n<")
  .replace(/(<p>) +/g, "$1").replace(/ +<\/p>/g, "</p>").trim();
export const MORAL_FLOW_BLOCK_TEMPLATES = Object.freeze({
  comparecencia: naturalParagraphs(MORAL_BLOCK_TEMPLATES.comparecencia),
  antecedentes_identidad: naturalParagraphs(MORAL_BLOCK_TEMPLATES.antecedentes_identidad),
  firma: MORAL_BLOCK_TEMPLATES.firma,
});

export function buildLandlordBlocks(landlord: ContractTemplateContext["arrendador"], revision = LANDLORD_BLOCK_REVISION): BloquesArrendadorResueltos {
  if (landlord.tipo === "PERSONA") throw new Error("La plantilla todavía no dispone de bloques contractuales aprobados para persona física. No se puede generar un nuevo documento con esta plantilla.");
  if (landlord.tipo !== "PERSONA_MORAL" || !landlord.representante) throw new Error("No se pueden construir los bloques contractuales: falta el arrendador persona moral o su representante.");
  if (![LANDLORD_BLOCK_REVISION, LEGACY_LANDLORD_BLOCK_REVISION].includes(revision)) throw new Error("Revisión de bloques contractuales desconocida.");
  const templates = revision === LEGACY_LANDLORD_BLOCK_REVISION ? MORAL_BLOCK_TEMPLATES : MORAL_FLOW_BLOCK_TEMPLATES;
  const values: Record<string, string> = {
    "arrendador.razon_social": landlord.razon_social,
    "arrendador.representante.caracter": landlord.representante.caracter,
    "arrendador.representante.nombre_completo": landlord.representante.nombre_completo,
  };
  const resolve = (html: string) => html.replace(/{{([^{}]+)}}/g, (_match, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error("Variable desconocida en el bloque contractual: " + name);
    return escapeHtml(values[name]);
  });
  return { revision, tipo: "PERSONA_MORAL",
    comparecencia: resolve(templates.comparecencia),
    antecedentes_identidad: resolve(templates.antecedentes_identidad),
    firma: resolve(templates.firma) };
}

export function requireLandlordBlocks(landlord: ContractTemplateContext["arrendador"]): BloquesArrendadorResueltos {
  // Validar también la procedencia del HTML: un objeto del cliente no autoriza HTML arbitrario.
  const expected = buildLandlordBlocks(landlord, landlord.bloques?.revision);
  const blocks = landlord.bloques;
  if (!blocks || blocks.revision !== expected.revision || blocks.tipo !== expected.tipo ||
      blocks.comparecencia !== expected.comparecencia || blocks.antecedentes_identidad !== expected.antecedentes_identidad || blocks.firma !== expected.firma) {
    throw new Error("Los bloques contractuales requeridos no están resueltos o no corresponden a la revisión aprobada.");
  }
  return blocks;
}
