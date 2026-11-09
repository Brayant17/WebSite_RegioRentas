import type { ContractTemplateContext, TemplateRenderResult } from "./types";
import { escapeHtml } from "./utils/escapeHtml";
export { escapeHtml } from "./utils/escapeHtml";
import { LANDLORD_BLOCK_VARIABLES, requireLandlordBlocks } from "./services/landlordBlocks";

export const TEMPLATE_VARIABLES = [
  ...LANDLORD_BLOCK_VARIABLES,
  "arrendador.tipo", "arrendador.nombre",
  "contrato.folio", "contrato.fecha_inicio", "contrato.fecha_inicio_letra", "contrato.fecha_fin", "contrato.fecha_fin_letra",
  "contrato.costo_lavanderia", "contrato.domicilio_arrendador", "contrato.domicilio_arrendatario", "contrato.domicilio_fiador",
  "contrato.renta", "contrato.renta_letra", "contrato.deposito", "contrato.deposito_letra", "contrato.dia_pago",
  "contrato.fecha_firma", "contrato.fecha_firma_letra", "contrato.lugar_firma",
  "arrendador.razon_social", "arrendador.nombre_comercial", "arrendador.rfc", "arrendador.domicilio",
  "arrendador.ciudad", "arrendador.estado", "arrendador.codigo_postal", "arrendador.telefono", "arrendador.correo",
  "arrendador.representante.nombre_completo", "arrendador.representante.caracter", "arrendador.representante.rfc",
  "arrendador.representante.curp", "arrendador.representante.telefono", "arrendador.representante.correo",
  "arrendatario.nombre_completo", "arrendatario.rfc", "arrendatario.curp", "arrendatario.domicilio", "arrendatario.telefono", "arrendatario.correo",
  "fiador.nombre_completo", "fiador.rfc", "fiador.curp", "fiador.domicilio", "fiador.telefono", "fiador.correo",
  "inmueble.nombre", "inmueble.direccion", "inmueble.ciudad", "inmueble.estado", "inmueble.codigo_postal", "inmueble.direccion_completa",
  "unidad.nombre", "unidad.numero", "unidad.tipo", "unidad.piso", "unidad.ubicacion",
] as const;
const allowedVariables: ReadonlySet<string> = new Set(TEMPLATE_VARIABLES);


function variableValue(context: ContractTemplateContext, variable: string): unknown {
  let value: unknown = context;
  for (const segment of variable.split(".")) {
    if (typeof value !== "object" || value === null || !Object.hasOwn(value, segment)) return "";
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

// Puro: una sola pasada, sin eval, DOM, React, consultas ni sustitución recursiva de valores.
// html aún debe sanitizarse antes de mostrarse en un navegador.
export function renderContractTemplate(templateHtml: string, context: ContractTemplateContext): TemplateRenderResult {
  const unresolved = new Set<string>();
  const html = templateHtml.replace(/{{([\s\S]*?)}}/g, (_match, token: string) => {
    const variable = token.trim();
    if (!allowedVariables.has(variable)) {
      unresolved.add(variable);
      return `{{${escapeHtml(variable)}}}`;
    }
    if ((LANDLORD_BLOCK_VARIABLES as readonly string[]).includes(variable)) {
      const blocks = requireLandlordBlocks(context.arrendador);
      return blocks[variable.split(".")[2] as "comparecencia" | "antecedentes_identidad" | "firma"];
    }
    return escapeHtml(variableValue(context, variable));
  });
  return { html, unresolvedVariables: [...unresolved].sort() };
}
