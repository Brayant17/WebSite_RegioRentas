import { supabase } from "@/lib/supabaseClient";
import type { TemplateContractSource, TemplateRepresentative, TemplateVersion, TemplateVersionOption } from "../types";
import { contractPartiesEnabled } from "../../partes/model";

const personSelect = "id, nombre, apellido_paterno, apellido_materno, rfc, curp, domicilio_origen, telefono, correo";
const versionSelect = "id, plantilla_id, numero_version, estado, plantilla:plantillas!plantilla_id(id, nombre, descripcion, estado)";

export async function getTemplateContract(id: string, partiesModel = contractPartiesEnabled) {
  const { data, error } = await supabase.from("contratos").select(`
    costo_lavanderia, domicilio_arrendador, domicilio_arrendatario, domicilio_fiador,
    id, estado, arrendador_persona_moral_id, folio, fecha_inicio, fecha_fin, renta, deposito, dia_pago, fecha_firma, lugar_firma,
    partes:partes_contrato(id, rol, ${partiesModel ? "persona_id, persona_moral_id," : ""} persona:personas!persona_id(${personSelect})),
    unidad:unidades!unidad_id(nombre, numero, tipo, piso, ubicacion,
      edificio:edificios!edificio_id(nombre, direccion, ciudad, estado, codigo_postal))
  `).eq("id", id).maybeSingle<TemplateContractSource>();
  if (error) throw error;
  return data;
}

export async function getTemplateRepresentatives(companyId: string) {
  const { data, error } = await supabase.from("representantes_persona_moral")
    .select(`id, caracter, persona:personas!persona_id(${personSelect})`)
    .eq("persona_moral_id", companyId).eq("es_principal", true).returns<TemplateRepresentative[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getDraftTemplateVersions() {
  const { data, error } = await supabase.from("versiones_plantilla").select(versionSelect)
    .eq("estado", "BORRADOR").order("plantilla_id").order("numero_version", { ascending: false }).returns<TemplateVersionOption[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getDraftTemplateVersion(id: string) {
  const { data, error } = await supabase.from("versiones_plantilla").select(`${versionSelect}, contenido`)
    .eq("id", id).eq("estado", "BORRADOR").maybeSingle<TemplateVersion>();
  if (error) throw error;
  return data;
}
