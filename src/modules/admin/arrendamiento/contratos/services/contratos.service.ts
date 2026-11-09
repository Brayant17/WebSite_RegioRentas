import * as repository from "../repositories/contratos.repository";
import type { ContractFormValues, ContractTerms, ContractDraftTerms } from "../types";
import type { LandlordSelection } from "../partes/model";

export const listContracts = repository.getContracts;
export const findContract = repository.getContractById;
export const findApplicationContract = repository.getContractByApplication;

export async function loadContractCreation(solicitudId: string) {
  const [application, contract] = await Promise.all([
    repository.getContractApplication(solicitudId),
    repository.getContractByApplication(solicitudId),
  ]);
  return { application, contract };
}

// Solo se aceptan importes decimales sin separadores de miles ni moneda.
// Los textos ambiguos se dejan para captura manual, nunca se reinterpretan.
export function parseAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount <= 9999999999.99 ? amount : null;
}

export function parseContractForm(values: ContractFormValues): ContractTerms {
  const renta = parseAmount(values.renta);
  const deposito = parseAmount(values.deposito);
  // Validación de captura para UX; PostgreSQL conserva la autoridad de las reglas.
  for (const value of [values.fecha_inicio, values.fecha_fin]) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error("Ingresa fechas válidas de inicio y fin.");
    }
  }
  if (values.fecha_fin <= values.fecha_inicio) throw new Error("La fecha de fin debe ser posterior a la fecha de inicio.");
  if (renta === null || renta <= 0) throw new Error("Ingresa una renta mayor que cero, con hasta dos decimales.");
  if (deposito === null) throw new Error("Ingresa un depósito de cero o mayor, con hasta dos decimales.");
  const dia_pago = Number(values.dia_pago);
  if (!/^\d{1,2}$/.test(values.dia_pago) || dia_pago < 1 || dia_pago > 31) throw new Error("El día de pago debe ser un entero entre 1 y 31.");
  return { fecha_inicio: values.fecha_inicio, fecha_fin: values.fecha_fin, renta, deposito, dia_pago };
}

export function createContract(solicitudId: string, values: ContractFormValues, landlord?: LandlordSelection) {
  return repository.createContractFromApplication(solicitudId, parseContractForm(values), landlord);
}

export function parseDraftForm(values: ContractFormValues): ContractDraftTerms {
  const terms: ContractDraftTerms = parseContractForm(values);
  if (values.costo_lavanderia !== undefined) {
    const text = values.costo_lavanderia.trim();
    const amount = Number(text);
    if (text && (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(amount) || amount < 0)) {
      throw new Error("Ingresa un costo de lavandería de cero o mayor, sin símbolos de moneda ni separadores de miles.");
    }
    terms.costo_lavanderia = text ? amount : null;
  }
  for (const field of ["domicilio_arrendador", "domicilio_arrendatario", "domicilio_fiador"] as const) {
    if (values[field] !== undefined) terms[field] = values[field].trim() || null;
  }
  if (values.lugar_firma !== undefined) terms.lugar_firma = values.lugar_firma.trim() || null;
  if (values.fecha_firma !== undefined) {
    const value = values.fecha_firma.trim();
    if (value) {
      const date = new Date(value + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new Error("Ingresa una fecha de firma válida.");
      }
    }
    // DATE: conservar el texto de calendario, sin convertirlo a hora local.
    terms.fecha_firma = value || null;
  }
  return terms;
}

export function saveDraft(id: string, values: ContractFormValues) {
  return repository.updateDraftContract(id, parseDraftForm(values));
}

export function contractErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message :
    typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "23505" || /ya (existe|tiene).*contrato|contrato.*ya existe/i.test(message)) return "La solicitud ya tiene un contrato. Actualiza la consulta para verlo.";
  if (/configuracion_sistema|arrendador.*configurado/i.test(message)) return "No se pudo obtener el arrendador configurado. Solicita al responsable del sistema revisar su configuración.";
  if (code === "PGRST202" || code === "42703") return "La configuración del módulo de partes todavía no está completa. Contacta al responsable del despliegue.";
  if (code === "42501" || /row-level security|permission denied|administrador|admin|sesión|session|jwt/i.test(message)) return "Tu sesión no tiene autorización para esta operación. Ingresa nuevamente con una cuenta administradora.";
  if (/aprobada/i.test(message)) return "Solo puedes generar contratos desde solicitudes aprobadas. Actualiza la solicitud.";
  if (/solicitante/i.test(message)) return "La solicitud no tiene un solicitante válido. Revisa sus participantes.";
  if (/fetch|network|networkerror/i.test(message)) return "No se pudo conectar con el servidor. Revisa tu conexión y actualiza la consulta antes de reintentar.";
  if (error instanceof Error || code === "P0001") return message || "No se pudo completar la operación.";
  return "No se pudo completar la operación de contratos. Intenta actualizar la consulta; si persiste, contacta al responsable del sistema.";
}
