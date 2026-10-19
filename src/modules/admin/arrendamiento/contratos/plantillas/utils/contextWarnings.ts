import type { ContractTemplateContext } from "../types";
import { templateText } from "./formatters";

export function importantEmptyFields(context: ContractTemplateContext) {
  const fields = [
    ["contrato.fecha_firma", "Fecha de firma", context.contrato.fecha_firma],
    ["contrato.lugar_firma", "Lugar de firma", context.contrato.lugar_firma],
    ["arrendador.razon_social", "Razón social del arrendador", context.arrendador.razon_social],
    ["arrendador.representante.nombre_completo", "Nombre del representante", context.arrendador.representante?.nombre_completo],
    ["arrendatario.nombre_completo", "Nombre del arrendatario", context.arrendatario.nombre_completo],
    ["inmueble.direccion_completa", "Dirección del inmueble", context.inmueble.direccion_completa],
    ["contrato.renta", "Renta", context.contrato.renta],
    ["contrato.fecha_inicio", "Fecha de inicio", context.contrato.fecha_inicio],
    ["contrato.fecha_fin", "Fecha de fin", context.contrato.fecha_fin],
  ] as const;
  return fields.filter(([variable, , value]) => !(context.arrendador.tipo === "PERSONA" && ["arrendador.razon_social", "arrendador.representante.nombre_completo"].includes(variable)) && !templateText(value)).map(([variable, label]) => ({ variable, label }));
}

export type EmptyFieldWarning = ReturnType<typeof importantEmptyFields>[number];
