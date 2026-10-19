import { supabase } from "@/lib/supabaseClient";
import type { Contract, ContractApplication, ContractDetail, ContractDraftTerms, ContractSummary, ContractTerms } from "../types";
import { contractPartiesEnabled, validateLandlord, type LandlordSelection } from "../partes/model";

const summarySelect = `id, solicitud_id, unidad_id, arrendador_persona_moral_id, folio, fecha_inicio, fecha_fin,
  renta, deposito, dia_pago, fecha_firma, lugar_firma, estado, created_at, updated_at,
  unidad:unidades!unidad_id(nombre, edificio:edificios!edificio_id(nombre))`;
const personSelect = "id, nombre, apellido_paterno, apellido_materno, telefono, correo";

export async function getContracts(): Promise<ContractSummary[]> {
  const { data, error } = await supabase.from("contratos").select(summarySelect)
    .order("created_at", { ascending: false }).returns<ContractSummary[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getContractById(id: string): Promise<ContractDetail | null> {
  const { data, error } = await supabase.from("contratos")
    .select(`${summarySelect}, costo_lavanderia, domicilio_arrendador, domicilio_arrendatario, domicilio_fiador, partes:partes_contrato(id, rol, ${contractPartiesEnabled ? "persona_id, persona_moral_id, persona_moral:personas_morales!persona_moral_id(id, razon_social, telefono, correo)," : ""} persona:personas!persona_id(${personSelect}))`)
    .eq("id", id).maybeSingle<ContractDetail>();
  if (error) throw error;
  return data;
}

export async function getContractByApplication(solicitudId: string): Promise<Pick<Contract, "id" | "folio" | "estado"> | null> {
  const { data, error } = await supabase.from("contratos").select("id, folio, estado")
    .eq("solicitud_id", solicitudId).maybeSingle<Pick<Contract, "id" | "folio" | "estado">>();
  if (error) throw error;
  return data;
}

export async function getContractApplication(id: string): Promise<ContractApplication | null> {
  const { data, error } = await supabase.from("solicitudes")
    .select(`id, folio, estatus, fecha_estimada_ocupacion,
      unidad:unidades!unidad_id(nombre, precio_renta, edificio:edificios!edificio_id(nombre)),
      participantes:participantes_solicitud(rol, persona:personas!persona_id(${personSelect}))`)
    .eq("id", id).maybeSingle<ContractApplication>();
  if (error) throw error;
  return data;
}

export async function createContractFromApplication(solicitudId: string, terms: ContractTerms, landlord?: LandlordSelection): Promise<string> {
  const selected = contractPartiesEnabled ? validateLandlord(landlord) : undefined;
  const { data, error } = await supabase.rpc("crear_contrato_desde_solicitud", {
    p_solicitud_id: solicitudId,
    p_fecha_inicio: terms.fecha_inicio,
    p_fecha_fin: terms.fecha_fin,
    p_renta: terms.renta,
    p_deposito: terms.deposito,
    p_dia_pago: terms.dia_pago,
    ...(selected ? { p_arrendador_tipo: selected.tipo, p_arrendador_id: selected.id } : {}),
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) throw new Error("No se recibió el identificador del contrato. Consulta la lista de contratos antes de reintentar.");
  return data;
}

export async function updateDraftContract(id: string, terms: ContractDraftTerms): Promise<Contract> {
  // Lista explícita de campos; el filtro se evalúa en la misma operación que el UPDATE.
  const { data, error } = await supabase.from("contratos").update({
    fecha_inicio: terms.fecha_inicio,
    fecha_fin: terms.fecha_fin,
    renta: terms.renta,
    deposito: terms.deposito,
    dia_pago: terms.dia_pago,
    ...(terms.fecha_firma !== undefined ? { fecha_firma: terms.fecha_firma } : {}),
    ...(terms.lugar_firma !== undefined ? { lugar_firma: terms.lugar_firma } : {}),
    ...(terms.costo_lavanderia !== undefined ? { costo_lavanderia: terms.costo_lavanderia } : {}),
    ...(terms.domicilio_arrendador !== undefined ? { domicilio_arrendador: terms.domicilio_arrendador } : {}),
    ...(terms.domicilio_arrendatario !== undefined ? { domicilio_arrendatario: terms.domicilio_arrendatario } : {}),
    ...(terms.domicilio_fiador !== undefined ? { domicilio_fiador: terms.domicilio_fiador } : {}),
  }).eq("id", id).eq("estado", "BORRADOR").select().maybeSingle<Contract>();
  if (error) throw error;
  if (!data) throw new Error("No se pudo guardar: el contrato ya no está en BORRADOR, no existe o no tienes permiso. Actualiza el detalle.");
  return data;
}
